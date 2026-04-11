import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { requirePermission } from "@/lib/require-permission"
import { z } from "zod"

const transactionUpdateSchema = z.object({
  description: z
    .string()
    .min(1, "Buchungstext darf nicht leer sein")
    .max(500, "Buchungstext darf maximal 500 Zeichen lang sein")
    .optional(),
  note: z
    .string()
    .max(1000, "Bemerkung darf maximal 1000 Zeichen lang sein")
    .optional(),
  document_ref: z
    .string()
    .max(255, "Beleg-Referenz darf maximal 255 Zeichen lang sein")
    .optional(),
  statement_ref: z
    .string()
    .max(255, "Kontoauszug-Referenz darf maximal 255 Zeichen lang sein")
    .optional(),
})

// Erlaubte Felder für das Update (schreibgeschützte Bankdaten ausgeschlossen)
const ALLOWED_FIELDS = ["description", "note", "document_ref", "statement_ref"]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Auth + Berechtigung (edit_transactions) + Rate Limiting prüfen
    const auth = await requirePermission("edit_transactions")
    if (auth.error) return auth.error

    const supabase = await createServerSupabaseClient()

    // Request-Body validieren
    const body = await request.json()

    // Nur erlaubte Felder durchlassen
    const filteredBody: Record<string, unknown> = {}
    for (const key of Object.keys(body)) {
      if (ALLOWED_FIELDS.includes(key)) {
        filteredBody[key] = body[key]
      }
    }

    if (Object.keys(filteredBody).length === 0) {
      return NextResponse.json(
        { error: "Keine gültigen Felder zum Aktualisieren" },
        { status: 400 }
      )
    }

    const validation = transactionUpdateSchema.safeParse(filteredBody)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ungültige Daten" },
        { status: 400 }
      )
    }

    // Transaktion prüfen, ob sie existiert
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("id", id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: "Buchung nicht gefunden" },
        { status: 404 }
      )
    }

    // Update durchführen mit Audit-Feldern
    const updateData = {
      ...validation.data,
      updated_at: new Date().toISOString(),
      updated_by: auth.profile.id,
    }

    const { data, error } = await supabase
      .from("transactions")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        id,
        booking_date,
        value_date,
        description,
        amount,
        balance_after,
        category,
        note,
        document_ref,
        statement_ref,
        updated_at,
        updated_by,
        statement_id,
        bank_statements!inner(statement_number, file_name)
      `
      )
      .single()

    if (error) {
      console.error("Fehler beim Aktualisieren der Buchung:", error)
      return NextResponse.json(
        { error: "Fehler beim Speichern: " + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Transaction PATCH Fehler:", error)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
