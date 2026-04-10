import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { confirmImportSchema } from "@/lib/validations/import"

/**
 * POST /api/admin/import/confirm
 * Speichert die geprüften Buchungen in der Datenbank.
 */
export async function POST(request: Request) {
  const authResult = await requireAdmin()
  if (authResult.error) {
    return authResult.error
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 }
    )
  }

  const validation = confirmImportSchema.safeParse(body)
  if (!validation.success) {
    const firstError =
      validation.error.issues[0]?.message ?? "Ungültige Eingabe."
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const {
    statement_number,
    statement_date,
    file_name,
    file_path,
    start_balance,
    end_balance,
    transactions,
  } = validation.data
  const { profile } = authResult
  const adminClient = createAdminSupabaseClient()

  // 1. Bank-Statement Eintrag erstellen
  const { data: statement, error: statementError } = await adminClient
    .from("bank_statements")
    .insert({
      file_name,
      statement_date,
      statement_number,
      transaction_count: transactions.length,
      start_balance,
      end_balance,
      file_path,
      uploaded_by: profile.id,
    })
    .select("id")
    .single()

  if (statementError || !statement) {
    console.error("Fehler beim Erstellen des Kontoauszugs:", statementError?.message)
    return NextResponse.json(
      { error: "Kontoauszug konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }

  // 2. Buchungen einfügen
  const transactionRows = transactions.map((tx) => ({
    statement_id: statement.id,
    booking_date: tx.booking_date,
    value_date: tx.value_date,
    description: tx.description,
    amount: tx.amount,
    balance_after: tx.balance_after,
  }))

  const { error: txError } = await adminClient
    .from("transactions")
    .insert(transactionRows)

  if (txError) {
    console.error("Fehler beim Einfügen der Buchungen:", txError.message)

    // Kontoauszug-Eintrag wieder löschen (Rollback)
    await adminClient
      .from("bank_statements")
      .delete()
      .eq("id", statement.id)

    return NextResponse.json(
      { error: "Buchungen konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      message: `${transactions.length} Buchungen erfolgreich gespeichert.`,
      statement_id: statement.id,
      transaction_count: transactions.length,
    },
    { status: 201 }
  )
}
