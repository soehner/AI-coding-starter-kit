import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { updateCategoryAccessSchema } from "@/lib/validations/category-access"

/**
 * PROJ-14: Kategoriebasierter Zugriff für Betrachter
 *
 * GET  /api/admin/users/[id]/category-access
 *   Liest die aktuelle Kategorie-Einschränkung eines Benutzers.
 *   Antwort: { unrestricted: boolean, category_ids: string[] }
 *
 * PUT  /api/admin/users/[id]/category-access
 *   Setzt oder löscht die Einschränkung vollständig (Replace-Semantik).
 *   Body:   { unrestricted: boolean, category_ids?: string[] }
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { id: targetUserId } = await params
  if (!UUID_RE.test(targetUserId)) {
    return NextResponse.json(
      { error: "Ungültige Benutzer-ID." },
      { status: 400 }
    )
  }

  const admin = createAdminSupabaseClient()

  const { data: targetProfile, error: targetError } = await admin
    .from("user_profiles")
    .select("id, role")
    .eq("id", targetUserId)
    .single()

  if (targetError || !targetProfile) {
    return NextResponse.json(
      { error: "Benutzer nicht gefunden." },
      { status: 404 }
    )
  }

  const { data, error } = await admin
    .from("user_category_access")
    .select("category_id")
    .eq("user_id", targetUserId)

  if (error) {
    console.error("GET category-access Fehler:", error.message)
    return NextResponse.json(
      { error: "Kategorie-Zugriff konnte nicht geladen werden." },
      { status: 500 }
    )
  }

  const categoryIds = (data ?? []).map((row) => row.category_id as string)

  return NextResponse.json({
    unrestricted: categoryIds.length === 0,
    category_ids: categoryIds,
    role: targetProfile.role,
  })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { id: targetUserId } = await params
  if (!UUID_RE.test(targetUserId)) {
    return NextResponse.json(
      { error: "Ungültige Benutzer-ID." },
      { status: 400 }
    )
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 }
    )
  }

  const validation = updateCategoryAccessSchema.safeParse(rawBody)
  if (!validation.success) {
    return NextResponse.json(
      {
        error: validation.error.issues[0]?.message ?? "Ungültige Eingabe.",
      },
      { status: 400 }
    )
  }

  const { unrestricted, category_ids } = validation.data
  const admin = createAdminSupabaseClient()

  // Zielbenutzer prüfen – muss Betrachter sein
  const { data: targetProfile, error: targetError } = await admin
    .from("user_profiles")
    .select("id, role")
    .eq("id", targetUserId)
    .single()

  if (targetError || !targetProfile) {
    return NextResponse.json(
      { error: "Benutzer nicht gefunden." },
      { status: 404 }
    )
  }

  if (targetProfile.role === "admin") {
    return NextResponse.json(
      {
        error:
          "Kategorie-Einschränkungen gelten nur für Betrachter. Admins haben immer Vollzugriff.",
      },
      { status: 400 }
    )
  }

  // Vorhandene Zuordnungen vollständig entfernen
  const { error: deleteError } = await admin
    .from("user_category_access")
    .delete()
    .eq("user_id", targetUserId)

  if (deleteError) {
    console.error(
      "Fehler beim Zurücksetzen des Kategorie-Zugriffs:",
      deleteError.message
    )
    return NextResponse.json(
      { error: "Kategorie-Zugriff konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }

  // Bei "unrestricted" sind wir fertig – keine neuen Zeilen einfügen
  if (unrestricted || category_ids.length === 0) {
    return NextResponse.json({
      unrestricted: true,
      category_ids: [],
    })
  }

  // Prüfen, dass alle IDs tatsächlich existierende Kategorien referenzieren
  const { data: existingCats, error: catError } = await admin
    .from("categories")
    .select("id")
    .in("id", category_ids)

  if (catError) {
    console.error("Fehler beim Laden der Kategorien:", catError.message)
    return NextResponse.json(
      { error: "Kategorien konnten nicht überprüft werden." },
      { status: 500 }
    )
  }

  const existingIds = new Set((existingCats ?? []).map((c) => c.id))
  const validIds = category_ids.filter((id) => existingIds.has(id))

  if (validIds.length === 0) {
    return NextResponse.json(
      { error: "Keine der angegebenen Kategorien existiert." },
      { status: 400 }
    )
  }

  const rows = validIds.map((categoryId) => ({
    user_id: targetUserId,
    category_id: categoryId,
  }))

  const { error: insertError } = await admin
    .from("user_category_access")
    .insert(rows)

  if (insertError) {
    console.error(
      "Fehler beim Einfügen des Kategorie-Zugriffs:",
      insertError.message
    )
    return NextResponse.json(
      { error: "Kategorie-Zugriff konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }

  return NextResponse.json({
    unrestricted: false,
    category_ids: validIds,
  })
}
