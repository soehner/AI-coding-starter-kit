import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { updateRoleSchema } from "@/lib/validations/admin"

// PATCH: Rolle ändern
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

  // 3. Selbstschutz: Admin kann eigene Rolle nicht ändern
  if (authResult.profile.id === targetUserId) {
    return NextResponse.json(
      { error: "Du kannst deine eigene Rolle nicht ändern." },
      { status: 400 }
    )
  }

  // 4. Eingabe validieren
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 }
    )
  }

  const validation = updateRoleSchema.safeParse(body)
  if (!validation.success) {
    const firstError =
      validation.error.issues[0]?.message ?? "Ungültige Eingabe."
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { role } = validation.data
  const adminClient = createAdminSupabaseClient()

  // 5. Prüfen ob der Zielbenutzer existiert
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

  // 6. Letzter-Admin-Schutz: Verhindern, dass der letzte Admin zum Betrachter degradiert wird
  if (targetProfile.role === "admin" && role === "viewer") {
    const { data: admins, error: countError } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("role", "admin")

    if (countError) {
      return NextResponse.json(
        { error: "Admin-Anzahl konnte nicht geprüft werden." },
        { status: 500 }
      )
    }

    if (admins && admins.length <= 1) {
      return NextResponse.json(
        {
          error:
            "Der letzte Administrator kann nicht zum Betrachter geändert werden.",
        },
        { status: 400 }
      )
    }
  }

  // 7. Rolle aktualisieren
  const { error: updateError } = await adminClient
    .from("user_profiles")
    .update({ role })
    .eq("id", targetUserId)

  if (updateError) {
    console.error("Rollenänderungs-Fehler:", updateError.message)
    return NextResponse.json(
      { error: "Rolle konnte nicht geändert werden." },
      { status: 500 }
    )
  }

  return NextResponse.json({ message: "Rolle erfolgreich geändert." })
}

// DELETE: Benutzer löschen
export async function DELETE(
  _request: Request,
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

  // 3. Selbstschutz: Admin kann sich nicht selbst löschen
  if (authResult.profile.id === targetUserId) {
    return NextResponse.json(
      { error: "Du kannst dich nicht selbst löschen." },
      { status: 400 }
    )
  }

  const adminClient = createAdminSupabaseClient()

  // 4. Zielbenutzer-Profil laden
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

  // 5. Letzter-Admin-Schutz
  if (targetProfile.role === "admin") {
    const { data: admins, error: countError } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("role", "admin")

    if (countError) {
      return NextResponse.json(
        { error: "Admin-Anzahl konnte nicht geprüft werden." },
        { status: 500 }
      )
    }

    if (admins && admins.length <= 1) {
      return NextResponse.json(
        { error: "Der letzte Administrator kann nicht gelöscht werden." },
        { status: 400 }
      )
    }
  }

  // 6. Auth-Benutzer löschen (CASCADE loescht user_profiles automatisch)
  const { error: authError } = await adminClient.auth.admin.deleteUser(
    targetUserId
  )

  if (authError) {
    console.error("Auth-Löschfehler:", authError.message)
    return NextResponse.json(
      { error: "Benutzer konnte nicht gelöscht werden." },
      { status: 500 }
    )
  }

  return NextResponse.json({ message: "Benutzer erfolgreich gelöscht." })
}
