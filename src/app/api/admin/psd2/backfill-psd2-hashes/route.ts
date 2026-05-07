import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { backfillHashesSchema } from "@/lib/validations/psd2"
import { berechneMatchingHash, euroZuCent } from "@/lib/psd2/matching-hash"
import { wandleEbTransaktionUm } from "@/lib/psd2/sync"
import type { EbTransaction } from "@/lib/psd2/enablebanking-client"

/**
 * POST /api/admin/psd2/backfill-psd2-hashes
 *
 * Einmalig (oder in Batches) ausfuehrbarer Admin-Endpunkt, der fuer alle
 * bereits gemergden Eintraege (quelle='beide') aus den vorhandenen
 * `psd2_original_data` den PSD2-Hash neu berechnet und in
 * `matching_hash_psd2` einsetzt.
 *
 * Hintergrund: Bis Migration 026 wurde der PSD2-Hash beim Merge mit dem
 * PDF-Hash ueberschrieben. Beim naechsten PSD2-Sync wurde der Vorgang
 * dadurch nicht erkannt und ein Duplikat angelegt. Dieser Backfill
 * stellt den verlorenen PSD2-Hash wieder her.
 *
 * Endpoint kann mehrfach aufgerufen werden; verarbeitet jeweils den
 * naechsten Batch. Sobald keine Eintraege mehr offen sind, meldet er
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
    .select("id, psd2_original_data")
    .eq("quelle", "beide")
    .is("matching_hash_psd2", null)
    .not("psd2_original_data", "is", null)
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
  let uebersprungen = 0
  let fehler = 0

  for (const row of rows) {
    const original = row.psd2_original_data as EbTransaction | null
    if (!original) {
      uebersprungen++
      continue
    }

    const umgewandelt = wandleEbTransaktionUm(original)
    if (!umgewandelt) {
      uebersprungen++
      continue
    }

    const hash = berechneMatchingHash({
      buchungsdatum: umgewandelt.booking_date,
      betrag_cent: euroZuCent(umgewandelt.amount),
      iban_gegenseite: umgewandelt.iban_gegenseite,
      verwendungszweck: umgewandelt.description,
    })

    const { error: updateError } = await adminClient
      .from("transactions")
      .update({ matching_hash_psd2: hash })
      .eq("id", row.id)

    if (updateError) {
      console.error(
        "Backfill-PSD2-Hash-Fehler fuer",
        row.id,
        updateError.code,
        updateError.message
      )
      fehler++
      continue
    }
    erfolg++
  }

  return NextResponse.json({
    fertig: false,
    verarbeitet: erfolg,
    uebersprungen,
    fehler,
    naechster_aufruf:
      rows.length === batchSize
        ? "Weitere Eintraege offen — Endpunkt erneut aufrufen."
        : "Letzter Batch verarbeitet — erneut aufrufen zur Bestaetigung.",
  })
}
