import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { applyCategorizationRulesSchema } from "@/lib/validations/categorization-rules"
import {
  applyCategorizationRules,
  resolveScopeTransactionIds,
} from "@/lib/categorization-rules"

/**
 * POST /api/admin/categorization-rules/apply
 *
 * Wendet aktive Regeln auf Buchungen an. Zwei Modi:
 *
 * 1. `{ transaction_ids: [...] }` — explizite Chunk-Verarbeitung vom
 *    Frontend (bevorzugt, BUG-004). Das Frontend holt zuerst via
 *    `/apply/plan` alle IDs und ruft `/apply` dann mehrfach in kleinen
 *    Chunks auf, damit eine echte Progress-Anzeige möglich ist.
 *
 * 2. `{ scope: "uncategorized" | "all" }` — abwärtskompatibler
 *    Einzel-Request, der intern den Scope auflöst und alle IDs in einem
 *    Rutsch verarbeitet. Bleibt erhalten, wird aber vom neuen UI-Flow
 *    nicht mehr verwendet.
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

    const validation = applyCategorizationRulesSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Ziel-Buchungen bestimmen
    let transactionIds: string[]
    if (validation.data.transaction_ids) {
      transactionIds = validation.data.transaction_ids
    } else if (validation.data.scope) {
      try {
        transactionIds = await resolveScopeTransactionIds(
          supabase,
          validation.data.scope
        )
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Fehler beim Laden der Buchungen.",
          },
          { status: 500 }
        )
      }
    } else {
      return NextResponse.json(
        { error: "Entweder 'scope' oder 'transaction_ids' angeben." },
        { status: 400 }
      )
    }

    if (transactionIds.length === 0) {
      return NextResponse.json({
        message: "Keine passenden Buchungen gefunden.",
        processed: 0,
        categorized: 0,
        assignments_created: 0,
      })
    }

    try {
      const result = await applyCategorizationRules(supabase, transactionIds)
      return NextResponse.json({
        message: `Regeln auf ${result.processed} Buchungen angewendet – ${result.categorized} wurden kategorisiert.`,
        processed: result.processed,
        categorized: result.categorized,
        assignments_created: result.assignmentsCreated,
      })
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Fehler beim Anwenden der Regeln.",
        },
        { status: 500 }
      )
    }
  } catch (err) {
    console.error("POST /api/admin/categorization-rules/apply Fehler:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
