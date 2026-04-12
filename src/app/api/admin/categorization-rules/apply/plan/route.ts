import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { planCategorizationRulesSchema } from "@/lib/validations/categorization-rules"
import { resolveScopeTransactionIds } from "@/lib/categorization-rules"

/**
 * POST /api/admin/categorization-rules/apply/plan
 *
 * BUG-004: Liefert dem Frontend die vollständige Liste der Buchungs-IDs,
 * die für einen gegebenen Scope verarbeitet werden sollen. Das Frontend
 * ruft danach `/apply` chunk-weise auf, um eine echte Fortschrittsanzeige
 * darstellen zu können (statt eines blockierenden Einzel-Requests mit
 * indeterminiertem Spinner).
 *
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

    const validation = planCategorizationRulesSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    try {
      const transactionIds = await resolveScopeTransactionIds(
        supabase,
        validation.data.scope
      )
      return NextResponse.json({
        transaction_ids: transactionIds,
        total: transactionIds.length,
      })
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Fehler beim Ermitteln der Buchungen.",
        },
        { status: 500 }
      )
    }
  } catch (err) {
    console.error(
      "POST /api/admin/categorization-rules/apply/plan Fehler:",
      err
    )
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
