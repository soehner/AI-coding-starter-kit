import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/require-permission"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { bulkCategorizeSchema } from "@/lib/validations/categories"

/**
 * POST /api/transactions/bulk-categorize
 * Body: { action: "assign" | "remove", transaction_ids: string[], category_id: string }
 * Admins und Betrachter mit `edit_transactions`-Berechtigung.
 */
export async function POST(request: Request) {
  const auth = await requirePermission("edit_transactions")
  if (auth.error) return auth.error

  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { error: "Ungültiger Request-Body." },
        { status: 400 }
      )
    }

    const validation = bulkCategorizeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 }
      )
    }

    const { action, transaction_ids, category_id } = validation.data
    const uniqueTxIds = Array.from(new Set(transaction_ids))

    const supabase = await createServerSupabaseClient()

    // Kategorie muss existieren
    const { data: category, error: catErr } = await supabase
      .from("categories")
      .select("id")
      .eq("id", category_id)
      .maybeSingle()

    if (catErr) {
      return NextResponse.json(
        { error: "Fehler beim Prüfen der Kategorie: " + catErr.message },
        { status: 500 }
      )
    }
    if (!category) {
      return NextResponse.json(
        { error: "Kategorie nicht gefunden." },
        { status: 404 }
      )
    }

    if (action === "assign") {
      // Bestehende Zuordnungen ermitteln, um exakte Anzahl NEUER Zuordnungen zu liefern
      const { data: existing, error: existErr } = await supabase
        .from("transaction_categories")
        .select("transaction_id")
        .eq("category_id", category_id)
        .in("transaction_id", uniqueTxIds)

      if (existErr) {
        return NextResponse.json(
          {
            error:
              "Fehler beim Prüfen vorhandener Zuordnungen: " +
              existErr.message,
          },
          { status: 500 }
        )
      }

      const existingSet = new Set(
        (existing ?? []).map((r) => r.transaction_id as string)
      )
      const newRows = uniqueTxIds
        .filter((id) => !existingSet.has(id))
        .map((id) => ({
          transaction_id: id,
          category_id,
        }))

      if (newRows.length > 0) {
        const { error: insErr } = await supabase
          .from("transaction_categories")
          .insert(newRows)

        if (insErr) {
          return NextResponse.json(
            {
              error:
                "Fehler beim Zuordnen der Kategorie: " + insErr.message,
            },
            { status: 500 }
          )
        }
      }

      return NextResponse.json({
        success: true,
        changed: newRows.length,
        total: uniqueTxIds.length,
      })
    }

    // action === "remove"
    const { data: toDelete, error: preErr } = await supabase
      .from("transaction_categories")
      .select("transaction_id")
      .eq("category_id", category_id)
      .in("transaction_id", uniqueTxIds)

    if (preErr) {
      return NextResponse.json(
        {
          error:
            "Fehler beim Ermitteln der zu entfernenden Zuordnungen: " +
            preErr.message,
        },
        { status: 500 }
      )
    }

    const affectedCount = toDelete?.length ?? 0

    if (affectedCount > 0) {
      const { error: delErr } = await supabase
        .from("transaction_categories")
        .delete()
        .eq("category_id", category_id)
        .in("transaction_id", uniqueTxIds)

      if (delErr) {
        return NextResponse.json(
          {
            error:
              "Fehler beim Entfernen der Kategorie: " + delErr.message,
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      changed: affectedCount,
      total: uniqueTxIds.length,
    })
  } catch (err) {
    console.error("POST /api/transactions/bulk-categorize Fehler:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
