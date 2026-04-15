import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { requirePermission } from "@/lib/require-permission"
import {
  getCategoryFilter,
  isTransactionVisible,
} from "@/lib/category-access"
import { z } from "zod"

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss im Format YYYY-MM-DD sein")

const transactionUpdateSchema = z.object({
  description: z
    .string()
    .min(1, "Buchungstext darf nicht leer sein")
    .max(500, "Buchungstext darf maximal 500 Zeichen lang sein")
    .optional(),
  note: z
    .string()
    .max(1000, "Bemerkung darf maximal 1000 Zeichen lang sein")
    .nullable()
    .optional(),
  document_ref: z
    .string()
    .max(255, "Beleg-Referenz darf maximal 255 Zeichen lang sein")
    .optional(),
  statement_ref: z
    .string()
    .max(255, "Kontoauszug-Referenz darf maximal 255 Zeichen lang sein")
    .optional(),
  booking_date: isoDate.optional(),
  value_date: isoDate.optional(),
  amount: z
    .number()
    .finite("Betrag muss eine gültige Zahl sein")
    .min(-1_000_000, "Betrag außerhalb des erlaubten Bereichs")
    .max(1_000_000, "Betrag außerhalb des erlaubten Bereichs")
    .optional(),
  balance_after: z
    .number()
    .finite("Saldo muss eine gültige Zahl sein")
    .min(-1_000_000, "Saldo außerhalb des erlaubten Bereichs")
    .max(1_000_000, "Saldo außerhalb des erlaubten Bereichs")
    .optional(),
  category: z
    .string()
    .max(100, "Kategorie darf maximal 100 Zeichen lang sein")
    .nullable()
    .optional(),
})

// Erlaubte Felder für das Update (schreibgeschützte Bankdaten ausgeschlossen)
const ALLOWED_FIELDS = [
  "description",
  "note",
  "document_ref",
  "statement_ref",
  "booking_date",
  "value_date",
  "amount",
  "balance_after",
  "category",
]

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

    // PROJ-14: Sichtbarkeit der Buchung für eingeschränkte Betrachter prüfen.
    // Wenn die Buchung nicht in den erlaubten Kategorien liegt, geben wir
    // bewusst 404 zurück (nicht 403), um keine Informationen preiszugeben.
    const accessFilter = await getCategoryFilter(
      auth.profile.id,
      auth.profile.role
    )
    if (accessFilter.restricted) {
      const visible = await isTransactionVisible(id, accessFilter)
      if (!visible) {
        return NextResponse.json(
          { error: "Buchung nicht gefunden" },
          { status: 404 }
        )
      }
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
        bank_statements!inner(statement_number, file_name, file_path),
        transaction_documents(id, document_url, document_name, display_order, created_at),
        transaction_categories(
          category:categories(id, name, color, created_at)
        )
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

    // transaction_categories → categories / transaction_documents → documents flach zurückgeben
    type RawRow = {
      transaction_categories?: Array<{
        category: {
          id: string
          name: string
          color: string
          created_at: string
        } | null
      }> | null
      transaction_documents?: Array<{
        id: string
        document_url: string
        document_name: string
        display_order: number
        created_at: string
      }> | null
    } & Record<string, unknown>

    const row = data as unknown as RawRow
    const { transaction_categories, transaction_documents, ...rest } = row
    const categories = (transaction_categories ?? [])
      .map((tc) => tc.category)
      .filter(
        (c): c is {
          id: string
          name: string
          color: string
          created_at: string
        } => c !== null
      )
    const documents = [...(transaction_documents ?? [])].sort(
      (a, b) => a.display_order - b.display_order
    )

    return NextResponse.json({ ...rest, categories, documents })
  } catch (error) {
    console.error("Transaction PATCH Fehler:", error)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
