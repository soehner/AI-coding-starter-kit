import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { backfillHashesSchema } from "@/lib/validations/psd2"
import { berechneMatchingHash, euroZuCent } from "@/lib/psd2/matching-hash"

/**
 * POST /api/admin/psd2/backfill-hashes
 *
 * Einmalig ausfuehrbarer Admin-Endpunkt, der fuer alle bestehenden
 * transactions-Eintraege ohne matching_hash den Hash nachtraegt.
 * Wird in Baches verarbeitet, damit auch grosse Datenmengen ohne
 * Timeout durchlaufen.
 *
 * Der Endpunkt kann mehrfach aufgerufen werden; er verarbeitet jeweils
 * den naechsten Batch. Wenn kein Eintrag mehr offen ist, meldet er
 * `{ fertig: true }`.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {}

  const validation = backfillHashesSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Ungueltige Eingabe." },
      { status: 400 }
    )
  }

  const batchSize = validation.data.batch_size ?? 100
  const adminClient = createAdminSupabaseClient()

  const { data: rows, error } = await adminClient
    .from("transactions")
    .select("id, booking_date, amount, description, iban_gegenseite")
    .is("matching_hash", null)
    .limit(batchSize)

  if (error) {
    return NextResponse.json(
      { error: `Datenbank-Fehler: ${error.message}` },
      { status: 500 }
    )
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      fertig: true,
      verarbeitet: 0,
      message: "Keine weiteren Eintraege zu verarbeiten.",
    })
  }

  let erfolg = 0
  let kollisionen = 0
  for (const row of rows) {
    const hash = berechneMatchingHash({
      buchungsdatum: row.booking_date as string,
      betrag_cent: euroZuCent(Number(row.amount)),
      iban_gegenseite: (row.iban_gegenseite as string | null) ?? null,
      verwendungszweck: (row.description as string) ?? "",
    })

    const { error: updateError } = await adminClient
      .from("transactions")
      .update({ matching_hash: hash })
      .eq("id", row.id)

    if (updateError) {
      // Unique-Violation (Duplikat im Bestand) → tolerieren
      if (updateError.code === "23505") {
        kollisionen++
      } else {
        console.error(
          "Backfill-Fehler fuer",
          row.id,
          updateError.code,
          updateError.message
        )
      }
      continue
    }
    erfolg++
  }

  return NextResponse.json({
    fertig: false,
    verarbeitet: erfolg,
    kollisionen,
    hinweis:
      kollisionen > 0
        ? "Einige Eintraege haben identische Hashes (Duplikate im Bestand). Diese wurden uebersprungen."
        : undefined,
    naechster_aufruf:
      rows.length === batchSize
        ? "Weitere Eintraege offen — Endpunkt erneut aufrufen."
        : "Letzter Batch verarbeitet — erneut aufrufen zur Bestaetigung.",
  })
}
