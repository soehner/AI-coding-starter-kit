import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { updateCategorySchema } from "@/lib/validations/categories"
import { z } from "zod"

const paramsSchema = z.object({
  id: z.string().uuid("Ungültige Kategorie-ID."),
})

/**
 * PATCH /api/admin/categories/[id]
 * Umbenennen und/oder Farbe ändern. Nur Admins.
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

    const validation = updateCategorySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("categories")
      .update(validation.data)
      .eq("id", paramCheck.data.id)
      .select("id, name, color, created_at")
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Eine Kategorie mit diesem Namen existiert bereits." },
          { status: 409 }
        )
      }
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Kategorie nicht gefunden." },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: "Fehler beim Aktualisieren der Kategorie: " + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ category: data })
  } catch (err) {
    console.error("PATCH /api/admin/categories/[id] Fehler:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/categories/[id]
 * Löscht Kategorie samt allen Zuordnungen (ON DELETE CASCADE). Nur Admins.
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
      .from("categories")
      .delete()
      .eq("id", paramCheck.data.id)

    if (error) {
      return NextResponse.json(
        { error: "Fehler beim Löschen der Kategorie: " + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/admin/categories/[id] Fehler:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
