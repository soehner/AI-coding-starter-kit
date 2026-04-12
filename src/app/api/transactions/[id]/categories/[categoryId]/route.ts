import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/require-permission"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { z } from "zod"

const paramsSchema = z.object({
  id: z.string().uuid("Ungültige Buchungs-ID."),
  categoryId: z.string().uuid("Ungültige Kategorie-ID."),
})

/**
 * DELETE /api/transactions/[id]/categories/[categoryId]
 * Entfernt eine einzelne Kategorie von einer Buchung.
 * Admins und Betrachter mit `edit_transactions`-Berechtigung.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  const auth = await requirePermission("edit_transactions")
  if (auth.error) return auth.error

  try {
    const rawParams = await params
    const paramCheck = paramsSchema.safeParse(rawParams)
    if (!paramCheck.success) {
      return NextResponse.json(
        {
          error: paramCheck.error.issues[0]?.message ?? "Ungültige Parameter.",
        },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from("transaction_categories")
      .delete()
      .eq("transaction_id", paramCheck.data.id)
      .eq("category_id", paramCheck.data.categoryId)

    if (error) {
      return NextResponse.json(
        { error: "Fehler beim Entfernen der Kategorie: " + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(
      "DELETE /api/transactions/[id]/categories/[categoryId] Fehler:",
      err
    )
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
