import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createCategorySchema } from "@/lib/validations/categories"

/**
 * GET /api/admin/categories
 * Liefert alle Kategorien inkl. Anzahl zugeordneter Buchungen.
 * Nur Admins.
 */
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  try {
    const supabase = await createServerSupabaseClient()

    const { data: categories, error } = await supabase
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

    // Anzahl zugeordneter Buchungen je Kategorie (ein einzelner Query)
    const { data: assignments, error: assignErr } = await supabase
      .from("transaction_categories")
      .select("category_id")
      .limit(100000)

    if (assignErr) {
      return NextResponse.json(
        {
          error:
            "Fehler beim Laden der Kategorienzuordnungen: " + assignErr.message,
        },
        { status: 500 }
      )
    }

    const counts = new Map<string, number>()
    for (const row of assignments ?? []) {
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1)
    }

    const result = (categories ?? []).map((c) => ({
      ...c,
      transaction_count: counts.get(c.id) ?? 0,
    }))

    return NextResponse.json({ categories: result })
  } catch (err) {
    console.error("GET /api/admin/categories Fehler:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/categories
 * Legt eine neue Kategorie an.
 * Nur Admins.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { error: "Ungültiger Request-Body." },
        { status: 400 }
      )
    }

    const validation = createCategorySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: validation.data.name,
        color: validation.data.color,
      })
      .select("id, name, color, created_at")
      .single()

    if (error) {
      // Unique Constraint (case-insensitive Index) verletzt?
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Eine Kategorie mit diesem Namen existiert bereits." },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: "Fehler beim Anlegen der Kategorie: " + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { category: { ...data, transaction_count: 0 } },
      { status: 201 }
    )
  } catch (err) {
    console.error("POST /api/admin/categories Fehler:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
