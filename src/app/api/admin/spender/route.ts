import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { spenderSchema } from "@/lib/validations/spender"

const LIST_LIMIT = 200

/**
 * GET /api/admin/spender
 * Liste aller Spender. Optionaler Volltext-Filter via Query-Parameter
 * `?suche=<text>` (matcht auf name/email/ort).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const supabase = createAdminSupabaseClient()
  const { searchParams } = new URL(request.url)
  const suche = (searchParams.get("suche") || "").trim().slice(0, 200)

  let query = supabase
    .from("spender")
    .select("id, name, strasse, plz, ort, email, iban, created_at, updated_at")
    .order("name", { ascending: true })
    .limit(LIST_LIMIT)

  if (suche.length > 0) {
    // OR-Suche über mehrere Felder. PostgREST trennt Filter mit Kommas
    // und nutzt Klammern für Gruppierung — diese Zeichen müssen aus dem
    // User-Input raus, sonst kann der Suchstring den Filter umbiegen.
    // SQL-LIKE-Wildcards (%, _) werden ebenfalls escaped.
    const sanitized = suche
      .replace(/[%_]/g, "\\$&") // LIKE-Wildcards escapen
      .replace(/[(),*]/g, "") // PostgREST-Filter-Trenner entfernen
    if (sanitized.length > 0) {
      query = query.or(
        `name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,ort.ilike.%${sanitized}%`
      )
    }
  }

  const { data, error } = await query

  if (error) {
    console.error("Fehler beim Laden der Spender:", error.message)
    return NextResponse.json(
      { error: "Spender konnten nicht geladen werden." },
      { status: 500 }
    )
  }

  return NextResponse.json({ spender: data ?? [] })
}

/**
 * POST /api/admin/spender
 * Legt einen neuen Spender an. Body = JSON nach `spenderSchema`.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 }
    )
  }

  const validation = spenderSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Ungültige Eingabe." },
      { status: 400 }
    )
  }

  const data = validation.data
  const supabase = createAdminSupabaseClient()

  const { data: inserted, error } = await supabase
    .from("spender")
    .insert({
      name: data.name,
      strasse: data.strasse || null,
      plz: data.plz || null,
      ort: data.ort || null,
      email: data.email || null,
      iban: data.iban || null,
    })
    .select(
      "id, name, strasse, plz, ort, email, iban, created_at, updated_at"
    )
    .single()

  if (error || !inserted) {
    console.error("Fehler beim Anlegen des Spenders:", error?.message)
    return NextResponse.json(
      { error: "Spender konnte nicht angelegt werden." },
      { status: 500 }
    )
  }

  return NextResponse.json({ spender: inserted }, { status: 201 })
}
