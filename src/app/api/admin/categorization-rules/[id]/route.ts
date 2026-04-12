import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { updateCategorizationRuleSchema } from "@/lib/validations/categorization-rules"

const paramsSchema = z.object({
  id: z.string().uuid("Ungültige Regel-ID."),
})

/**
 * PATCH /api/admin/categorization-rules/[id]
 *
 * PROJ-15: Aktualisiert Name, Kriterien-Liste, Verknüpfungsoperator,
 * Zielkategorie, Aktiv-Status oder sort_order. Die Validierung der
 * einzelnen Kriterien erfolgt in einem Rutsch durch das
 * `updateCategorizationRuleSchema` (inkl. `z.discriminatedUnion`).
 *
 * Nur Admins.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  try {
    const rawParams = await params
    const paramCheck = paramsSchema.safeParse(rawParams)
    if (!paramCheck.success) {
      return NextResponse.json(
        { error: paramCheck.error.issues[0]?.message ?? "Ungültige ID." },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { error: "Ungültiger Request-Body." },
        { status: 400 }
      )
    }

    const validation = updateCategorizationRuleSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Bestehende Regel prüfen (nur Existenz, keine Typ-Auflösung mehr nötig)
    const { data: existing, error: loadErr } = await supabase
      .from("categorization_rules")
      .select("id")
      .eq("id", paramCheck.data.id)
      .maybeSingle()

    if (loadErr) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Regel: " + loadErr.message },
        { status: 500 }
      )
    }
    if (!existing) {
      return NextResponse.json(
        { error: "Regel nicht gefunden." },
        { status: 404 }
      )
    }

    // Update-Payload aus einzelnen Feldern bauen. `combinator` und `criteria`
    // werden zur `condition`-Spalte zusammengefasst — und zwar als Atom,
    // nicht teilweise. Wer Kriterien ändern will, schickt die ganze Liste.
    const updatePayload: Record<string, unknown> = {}
    if (validation.data.name !== undefined) {
      updatePayload.name = validation.data.name
    }
    if (validation.data.is_active !== undefined) {
      updatePayload.is_active = validation.data.is_active
    }
    if (validation.data.sort_order !== undefined) {
      updatePayload.sort_order = validation.data.sort_order
    }
    if (
      validation.data.combinator !== undefined ||
      validation.data.criteria !== undefined
    ) {
      if (
        validation.data.combinator === undefined ||
        validation.data.criteria === undefined
      ) {
        return NextResponse.json(
          {
            error:
              "Für eine Änderung der Kriterien müssen `combinator` und `criteria` zusammen gesendet werden.",
          },
          { status: 400 }
        )
      }
      updatePayload.condition = {
        combinator: validation.data.combinator,
        criteria: validation.data.criteria,
      }
    }

    // Wenn category_id mitgegeben wurde, prüfen, dass sie existiert.
    // Gleichzeitig is_invalid zurücksetzen, wenn wieder eine gültige Kategorie
    // gesetzt wird.
    if (validation.data.category_id) {
      const { data: cat, error: catErr } = await supabase
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
      if (!cat) {
        return NextResponse.json(
          { error: "Die gewählte Kategorie existiert nicht." },
          { status: 400 }
        )
      }
      updatePayload.category_id = validation.data.category_id
      updatePayload.is_invalid = false
    }

    const { data, error } = await supabase
      .from("categorization_rules")
      .update(updatePayload)
      .eq("id", paramCheck.data.id)
      .select(
        "id, name, condition, category_id, is_active, is_invalid, sort_order, created_at, category:categories(id, name, color, created_at)"
      )
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Regel nicht gefunden." },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: "Fehler beim Aktualisieren der Regel: " + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ rule: data })
  } catch (err) {
    console.error("PATCH /api/admin/categorization-rules/[id] Fehler:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/categorization-rules/[id]
 * Löscht eine Regel. Bestehende Kategoriezuordnungen bleiben erhalten.
 * Nur Admins.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  try {
    const rawParams = await params
    const paramCheck = paramsSchema.safeParse(rawParams)
    if (!paramCheck.success) {
      return NextResponse.json(
        { error: paramCheck.error.issues[0]?.message ?? "Ungültige ID." },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from("categorization_rules")
      .delete()
      .eq("id", paramCheck.data.id)

    if (error) {
      return NextResponse.json(
        { error: "Fehler beim Löschen der Regel: " + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/admin/categorization-rules/[id] Fehler:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
