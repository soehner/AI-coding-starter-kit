import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/require-permission"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { setTransactionCategoriesSchema } from "@/lib/validations/categories"
import { z } from "zod"

const paramsSchema = z.object({
  id: z.string().uuid("Ungültige Buchungs-ID."),
})

/**
 * POST /api/transactions/[id]/categories
 * Setzt die komplette Kategorienliste einer Buchung (ersetzt vorhandene).
 * Body: { category_ids: string[] }
 * Admins und Betrachter mit `edit_transactions`-Berechtigung.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("edit_transactions")
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

    const validation = setTransactionCategoriesSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 }
      )
    }

    const transactionId = paramCheck.data.id
    const categoryIds = Array.from(new Set(validation.data.category_ids))

    const supabase = await createServerSupabaseClient()

    // Buchung muss existieren
    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .select("id")
      .eq("id", transactionId)
      .maybeSingle()

    if (txError) {
      return NextResponse.json(
        { error: "Fehler beim Prüfen der Buchung: " + txError.message },
        { status: 500 }
      )
    }

    if (!tx) {
      return NextResponse.json(
        { error: "Buchung nicht gefunden." },
        { status: 404 }
      )
    }

    // Alle Zuordnungen der Buchung entfernen
    const { error: delError } = await supabase
      .from("transaction_categories")
      .delete()
      .eq("transaction_id", transactionId)

    if (delError) {
      return NextResponse.json(
        {
          error:
            "Fehler beim Entfernen alter Zuordnungen: " + delError.message,
        },
        { status: 500 }
      )
    }

    // Neue Zuordnungen einfügen (falls welche übergeben wurden)
    if (categoryIds.length > 0) {
      const rows = categoryIds.map((category_id) => ({
        transaction_id: transactionId,
        category_id,
      }))
      const { error: insError } = await supabase
        .from("transaction_categories")
        .insert(rows)

      if (insError) {
        return NextResponse.json(
          {
            error:
              "Fehler beim Zuordnen der Kategorien: " + insError.message,
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true, category_ids: categoryIds })
  } catch (err) {
    console.error(
      "POST /api/transactions/[id]/categories Fehler:",
      err
    )
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
