import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"

const reorderSchema = z.object({
  ordered_ids: z
    .array(z.string().uuid("Ungültige Regel-ID."))
    .min(1, "Mindestens eine Regel-ID erforderlich.")
    .max(1000, "Maximal 1000 Regeln pro Aufruf."),
})

/**
 * POST /api/admin/categorization-rules/reorder
 * Persistiert eine neue Reihenfolge (sort_order) für alle übergebenen Regeln.
 * Nur Admins.
 *
 * Hinweis: Die Reihenfolge ist rein kosmetisch (keine Priorität). Alle
 * zutreffenden Regeln werden beim Anwenden berücksichtigt.
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

    const validation = reorderSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 }
      )
    }

    const { ordered_ids } = validation.data

    // Duplikate abfangen
    if (new Set(ordered_ids).size !== ordered_ids.length) {
      return NextResponse.json(
        { error: "Doppelte Regel-IDs in der Reihenfolge." },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // BUG-006: Wir laden ALLE existierenden Regel-IDs und verlangen, dass
    // `ordered_ids` eine vollständige Permutation davon ist. Teilmengen
    // würden sonst zu Kollisionen bei `sort_order` führen (zwei Regeln
    // bekommen denselben Wert, weil nicht alle neu durchnummeriert werden).
    const { data: allRules, error: loadErr } = await supabase
      .from("categorization_rules")
      .select("id")
      .limit(1000)

    if (loadErr) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Regeln: " + loadErr.message },
        { status: 500 }
      )
    }

    const existingIds = new Set((allRules ?? []).map((r) => r.id as string))
    if (existingIds.size !== ordered_ids.length) {
      return NextResponse.json(
        {
          error:
            "Die übergebene Reihenfolge muss genau alle Regeln enthalten. " +
            `Erwartet: ${existingIds.size}, erhalten: ${ordered_ids.length}.`,
        },
        { status: 400 }
      )
    }
    for (const id of ordered_ids) {
      if (!existingIds.has(id)) {
        return NextResponse.json(
          { error: "Mindestens eine Regel-ID existiert nicht." },
          { status: 400 }
        )
      }
    }

    // Einzel-Updates in einer Schleife (kein praktikables Bulk-Update für
    // ID-abhängige Werte in Supabase; die Regelanzahl ist überschaubar).
    for (let i = 0; i < ordered_ids.length; i++) {
      const { error: updErr } = await supabase
        .from("categorization_rules")
        .update({ sort_order: i })
        .eq("id", ordered_ids[i])
      if (updErr) {
        return NextResponse.json(
          { error: "Fehler beim Speichern der Reihenfolge: " + updErr.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(
      "POST /api/admin/categorization-rules/reorder Fehler:",
      err
    )
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
