import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { getCategoryFilter } from "@/lib/category-access"
import type { Category } from "@/lib/types"

/**
 * PROJ-14: GET /api/me/category-access
 *
 * Liefert dem eingeloggten Benutzer die eigene Kategorie-Einschränkung.
 * Wird vom Dashboard genutzt, um den Hinweisbanner "Ihre Ansicht ist auf
 * bestimmte Kategorien beschränkt" einzublenden.
 *
 * Antwort:
 *   {
 *     restricted: boolean,
 *     category_ids: string[],
 *     allowedCategories: Category[]   // vollständige Objekte für den Banner
 *   }
 *
 * Admins und uneingeschränkte Betrachter erhalten:
 *   { restricted: false, category_ids: [], allowedCategories: [] }
 *
 * Warum Admin-Client zum Auflösen der Kategorien? Betrachter haben keinen
 * direkten Lese-Zugriff auf `categories` via RLS — sie sollen die Namen und
 * Farben ihrer erlaubten Kategorien aber im Banner sehen können.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Nicht authentifiziert." },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, role")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil nicht gefunden." },
        { status: 404 }
      )
    }

    const filter = await getCategoryFilter(profile.id, profile.role)

    if (!filter.restricted) {
      return NextResponse.json({
        restricted: false,
        category_ids: [],
        allowedCategories: [],
      })
    }

    // Vollständige Kategorie-Objekte für den Banner laden
    let allowedCategories: Category[] = []
    if (filter.allowedCategoryIds.length > 0) {
      const admin = createAdminSupabaseClient()
      const { data: cats, error: catError } = await admin
        .from("categories")
        .select("id, name, color, created_at")
        .in("id", filter.allowedCategoryIds)
        .order("name", { ascending: true })

      if (catError) {
        console.error(
          "Fehler beim Laden der erlaubten Kategorien:",
          catError.message
        )
      } else {
        allowedCategories = (cats ?? []) as Category[]
      }
    }

    return NextResponse.json({
      restricted: true,
      category_ids: filter.allowedCategoryIds,
      allowedCategories,
    })
  } catch (error) {
    console.error("GET /api/me/category-access Fehler:", error)
    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 }
    )
  }
}
