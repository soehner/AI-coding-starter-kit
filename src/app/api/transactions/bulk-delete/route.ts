import { NextResponse } from "next/server"
import { z } from "zod"
import { requirePermission } from "@/lib/require-permission"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getCategoryFilter } from "@/lib/category-access"

const bulkDeleteSchema = z.object({
  ids: z
    .array(z.string().uuid("Ungültige Buchungs-ID."))
    .min(1, "Mindestens eine Buchung muss ausgewählt sein.")
    .max(500, "Maximal 500 Buchungen pro Löschvorgang."),
})

/**
 * POST /api/transactions/bulk-delete
 * Löscht mehrere Buchungen in einem Rutsch. Gleiche Berechtigung wie
 * Einzel-Delete (`edit_transactions`). Eingeschränkte Betrachter dürfen
 * nur Buchungen löschen, die in ihren erlaubten Kategorien liegen —
 * nicht sichtbare IDs werden still übersprungen (kein Info-Leak).
 */
export async function POST(request: Request) {
  try {
    const auth = await requirePermission("edit_transactions")
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

    const validation = bulkDeleteSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error:
            validation.error.issues[0]?.message ?? "Ungültige Eingabe.",
        },
        { status: 400 }
      )
    }

    const { ids } = validation.data
    const supabase = await createServerSupabaseClient()

    // PROJ-14: Eingeschränkte Betrachter dürfen nur löschen, was sie sehen.
    // Wir filtern die IDs serverseitig, statt einzeln zu prüfen (Performance).
    const accessFilter = await getCategoryFilter(
      auth.profile.id,
      auth.profile.role
    )

    let erlaubteIds: string[] = ids
    if (accessFilter.restricted) {
      const allowedIds = accessFilter.allowedCategoryIds
      const { data: sichtbar } = await supabase
        .from("transactions")
        .select("id, transaction_categories(category_id)")
        .in("id", ids)

      erlaubteIds = (sichtbar ?? [])
        .filter((t: { transaction_categories?: Array<{ category_id: string }> | null }) => {
          const txKats = (t.transaction_categories ?? []).map(
            (tc) => tc.category_id
          )
          return txKats.some((kat) => allowedIds.includes(kat))
        })
        .map((t: { id: string }) => t.id)
    }

    if (erlaubteIds.length === 0) {
      return NextResponse.json({
        success: true,
        requested: ids.length,
        deleted: 0,
        skipped: ids.length,
      })
    }

    const { error, count } = await supabase
      .from("transactions")
      .delete({ count: "exact" })
      .in("id", erlaubteIds)

    if (error) {
      console.error("Fehler beim Bulk-Löschen:", error)
      return NextResponse.json(
        { error: "Fehler beim Löschen: " + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      requested: ids.length,
      deleted: count ?? erlaubteIds.length,
      skipped: ids.length - erlaubteIds.length,
    })
  } catch (error) {
    console.error("Bulk-Delete-Fehler:", error)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
