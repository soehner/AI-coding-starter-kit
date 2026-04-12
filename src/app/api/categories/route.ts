import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

/**
 * GET /api/categories
 * Liefert alle Kategorien für alle eingeloggten Benutzer (nur lesend).
 * Wird im Dashboard-Filter und in den Badges genutzt.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    )
  }

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, color, created_at")
    .order("name", { ascending: true })
    .limit(500)

  if (error) {
    return NextResponse.json(
      { error: "Fehler beim Laden der Kategorien: " + error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ categories: data ?? [] })
}
