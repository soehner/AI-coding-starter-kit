import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { updatePermissionsSchema } from "@/lib/validations/admin"

/**
 * PATCH /api/admin/users/[id]/permissions
 * Aktualisiert eine einzelne Feature-Berechtigung für einen Benutzer.
 * Nur Admins dürfen diese Route aufrufen.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Admin-Berechtigung prüfen (inkl. Rate-Limiting)
  const authResult = await requireAdmin()
  if (authResult.error) {
    return authResult.error
  }

  const { id: targetUserId } = await params

  // 2. UUID-Format validieren
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(targetUserId)) {
    return NextResponse.json(
      { error: "Ungültige Benutzer-ID." },
      { status: 400 }
    )
  }

  // 3. Request-Body parsen und validieren
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 }
    )
  }

  const validation = updatePermissionsSchema.safeParse(body)
  if (!validation.success) {
    const firstError =
      validation.error.issues[0]?.message ?? "Ungültige Eingabe."
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { permission, value } = validation.data
  const adminClient = createAdminSupabaseClient()

  // 4. Zielbenutzer prüfen: Muss existieren und Betrachter sein
  const { data: targetProfile, error: targetError } = await adminClient
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
          "Berechtigungen können nur für Betrachter gesetzt werden. Admins haben alle Berechtigungen implizit.",
      },
      { status: 400 }
    )
  }

  // 5. Berechtigung aktualisieren (upsert: erstellt Zeile falls sie fehlt)
  const { data: updatedPermissions, error: updateError } = await adminClient
    .from("user_permissions")
    .upsert({
      user_id: targetUserId,
      [permission]: value,
      updated_at: new Date().toISOString(),
    })
    .select("user_id, edit_transactions, export_excel, import_statements, updated_at")
    .single()

  if (updateError) {
    console.error("Fehler beim Aktualisieren der Berechtigungen:", updateError.message)
    return NextResponse.json(
      { error: "Berechtigungen konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }

  return NextResponse.json(updatedPermissions)
}
