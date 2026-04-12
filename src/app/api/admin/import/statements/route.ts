import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/require-permission"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

/**
 * GET /api/admin/import/statements
 * Gibt eine Liste aller importierten Kontoauszüge zurück.
 */
export async function GET() {
  // Auth + Berechtigung (import_statements) prüfen
  const authResult = await requirePermission("import_statements")
  if (authResult.error) {
    return authResult.error
  }

  const adminClient = createAdminSupabaseClient()

  // Sortierung nach Kontoauszugs-Datum absteigend, damit der neueste
  // Auszug (und damit die höchste Nr.) ganz oben steht. Bei identischem
  // Datum sekundär nach statement_number absteigend, damit die Reihenfolge
  // deterministisch bleibt.
  const { data: statements, error } = await adminClient
    .from("bank_statements")
    .select(
      "id, file_name, statement_date, statement_number, transaction_count, file_path, uploaded_by, created_at"
    )
    .order("statement_date", { ascending: false })
    .order("statement_number", { ascending: false })
    .limit(100)

  if (error) {
    console.error("Fehler beim Laden der Kontoauszüge:", error.message)
    return NextResponse.json(
      { error: "Kontoauszüge konnten nicht geladen werden." },
      { status: 500 }
    )
  }

  return NextResponse.json(statements)
}
