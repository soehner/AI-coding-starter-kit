import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createCategorizationRuleSchema } from "@/lib/validations/categorization-rules"

/**
 * GET /api/admin/categorization-rules
 * Liefert alle Kategorisierungsregeln (sortiert nach sort_order, dann created_at).
 * Nur Admins.
 */
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("categorization_rules")
      .select(
        "id, name, condition, category_id, is_active, is_invalid, sort_order, created_at, category:categories(id, name, color, created_at)"
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1000)

    if (error) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Regeln: " + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ rules: data ?? [] })
  } catch (err) {
    console.error("GET /api/admin/categorization-rules Fehler:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/categorization-rules
 * Legt eine neue Regel an. Nur Admins.
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

    const validation = createCategorizationRuleSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Prüfen, dass die Zielkategorie existiert (zusätzliche Absicherung,
    // FK fängt es zwar auch ab, aber so gibt es eine saubere Fehlermeldung).
    const { data: category, error: catErr } = await supabase
      .from("categories")
      .select("id")
      .eq("id", validation.data.category_id)
      .maybeSingle()

    if (catErr) {
      return NextResponse.json(
        { error: "Fehler bei Kategorie-Prüfung: " + catErr.message },
        { status: 500 }
      )
    }
    if (!category) {
      return NextResponse.json(
        { error: "Die gewählte Kategorie existiert nicht." },
        { status: 400 }
      )
    }

    // BUG-007: Insert läuft atomar über eine RPC mit Advisory-Lock, damit
    // parallele POSTs nicht denselben sort_order bekommen. Die RPC liefert
    // nur die neue ID zurück — die vollständige Zeile (inkl. Category-Join)
    // laden wir anschließend separat nach.
    // PROJ-15: condition ist jetzt {combinator, criteria[]} — wir serialisieren
    // aus den einzelnen Input-Feldern und geben es als JSONB an die RPC.
    const conditionPayload = {
      combinator: validation.data.combinator,
      criteria: validation.data.criteria,
    }

    const { data: newId, error: rpcErr } = await supabase.rpc(
      "insert_categorization_rule",
      {
        p_name: validation.data.name,
        p_condition: conditionPayload,
        p_category_id: validation.data.category_id,
        p_is_active: validation.data.is_active ?? true,
      }
    )

    if (rpcErr || !newId) {
      return NextResponse.json(
        {
          error:
            "Fehler beim Anlegen der Regel: " +
            (rpcErr?.message ?? "Keine ID zurückgegeben."),
        },
        { status: 500 }
      )
    }

    const { data, error } = await supabase
      .from("categorization_rules")
      .select(
        "id, name, condition, category_id, is_active, is_invalid, sort_order, created_at, category:categories(id, name, color, created_at)"
      )
      .eq("id", newId as string)
      .single()

    if (error || !data) {
      return NextResponse.json(
        {
          error:
            "Regel wurde angelegt, konnte aber nicht nachgeladen werden: " +
            (error?.message ?? "Unbekannter Fehler."),
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ rule: data }, { status: 201 })
  } catch (err) {
    console.error("POST /api/admin/categorization-rules Fehler:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
