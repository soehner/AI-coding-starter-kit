import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/require-permission"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { confirmImportSchema } from "@/lib/validations/import"
import { applyCategorizationRules } from "@/lib/categorization-rules"

/**
 * POST /api/admin/import/confirm
 * Speichert die geprüften Buchungen in der Datenbank.
 */
export async function POST(request: Request) {
  // Auth + Berechtigung (import_statements) prüfen
  const authResult = await requirePermission("import_statements")
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

  // PostgreSQL-Fehler in eine verständliche deutsche Meldung übersetzen
  function describeDbError(err: { code?: string; message?: string }): string {
    if (err.code === "23505") {
      // unique_violation — z.B. schon vorhandener Kontoauszug oder Buchung
      return "Eintrag existiert bereits in der Datenbank (Duplikat)."
    }
    if (err.code === "23503") {
      // foreign_key_violation
      return "Abhängiger Datensatz fehlt (Foreign-Key-Verletzung)."
    }
    if (err.code === "23502") {
      return "Pflichtfeld fehlt (NOT-NULL-Verletzung)."
    }
    return err.message || "Unbekannter Datenbankfehler."
  }

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
    console.error(
      "Fehler beim Erstellen des Kontoauszugs:",
      statementError?.code,
      statementError?.message
    )
    return NextResponse.json(
      {
        error: `Kontoauszug konnte nicht gespeichert werden: ${describeDbError(
          statementError ?? {}
        )}`,
      },
      { status: 500 }
    )
  }

  // 2. Buchungen einfügen
  const transactionRows = transactions.map((tx) => ({
    statement_id: statement.id,
    booking_date: tx.booking_date,
    value_date: tx.value_date,
    description: tx.description,
    counterpart: tx.counterpart ?? null,
    amount: tx.amount,
    balance_after: tx.balance_after,
  }))

  const { data: insertedTxs, error: txError } = await adminClient
    .from("transactions")
    .insert(transactionRows)
    .select("id")

  if (txError) {
    console.error(
      "Fehler beim Einfügen der Buchungen:",
      txError.code,
      txError.message
    )

    // Kontoauszug-Eintrag wieder löschen (Rollback)
    await adminClient.from("bank_statements").delete().eq("id", statement.id)

    return NextResponse.json(
      {
        error: `Buchungen konnten nicht gespeichert werden: ${describeDbError(
          txError
        )}`,
      },
      { status: 500 }
    )
  }

  // PROJ-13: Automatische Kategorisierung der frisch importierten Buchungen.
  // Fehler in der Regelanwendung dürfen den erfolgreichen Import NICHT rückgängig
  // machen – sie werden geloggt und als Warnung zurückgegeben.
  let autoCategorized = 0
  let autoAssignments = 0
  let rulesWarning: string | null = null
  const newTxIds = (insertedTxs ?? []).map((row) => row.id as string)
  if (newTxIds.length > 0) {
    try {
      const result = await applyCategorizationRules(adminClient, newTxIds)
      autoCategorized = result.categorized
      autoAssignments = result.assignmentsCreated
    } catch (err) {
      console.error("Fehler bei automatischer Kategorisierung:", err)
      rulesWarning =
        err instanceof Error
          ? err.message
          : "Regeln konnten nicht angewendet werden."
    }
  }

  return NextResponse.json(
    {
      message: `${transactions.length} Buchungen erfolgreich gespeichert.`,
      statement_id: statement.id,
      transaction_count: transactions.length,
      auto_categorized: autoCategorized,
      auto_assignments: autoAssignments,
      rules_warning: rulesWarning,
    },
    { status: 201 }
  )
}
