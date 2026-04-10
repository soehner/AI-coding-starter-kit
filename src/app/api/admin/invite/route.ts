import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { inviteUserSchema } from "@/lib/validations/admin"

export async function POST(request: Request) {
  // 1. Admin-Berechtigung prüfen (inkl. Rate-Limiting)
  const authResult = await requireAdmin()
  if (authResult.error) {
    return authResult.error
  }

  // 2. Request-Body parsen und validieren
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 }
    )
  }

  const validation = inviteUserSchema.safeParse(body)
  if (!validation.success) {
    const firstError =
      validation.error.issues[0]?.message ?? "Ungültige Eingabe."
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { email, role } = validation.data
  const normalizedEmail = email.toLowerCase().trim()

  // 3. Prüfen ob E-Mail bereits existiert
  const adminClient = createAdminSupabaseClient()

  const { data: existingProfiles } = await adminClient
    .from("user_profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .limit(1)

  if (existingProfiles && existingProfiles.length > 0) {
    return NextResponse.json(
      { error: "Ein Benutzer mit dieser E-Mail-Adresse existiert bereits." },
      { status: 409 }
    )
  }

  // 4. Benutzer einladen via Supabase Admin API
  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: { role },
    })

  if (inviteError) {
    console.error("Einladungsfehler:", inviteError.message)

    if (inviteError.message.includes("already been registered")) {
      return NextResponse.json(
        { error: "Diese E-Mail-Adresse ist bereits registriert." },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        error:
          "Einladung konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.",
      },
      { status: 500 }
    )
  }

  // 5. Rolle im user_profiles setzen
  // Der Trigger handle_new_user erstellt das Profil automatisch mit der Rolle
  // aus raw_user_meta_data. Falls der Trigger die Rolle nicht korrekt setzt,
  // aktualisieren wir hier explizit.
  if (inviteData.user) {
    const { error: updateError } = await adminClient
      .from("user_profiles")
      .upsert({
        id: inviteData.user.id,
        email: normalizedEmail,
        role: role,
      })

    if (updateError) {
      console.error("Fehler beim Setzen der Rolle:", updateError.message)
      // Einladung wurde trotzdem gesendet - Rolle kann später geändert werden
    }
  }

  return NextResponse.json(
    {
      message: "Einladung erfolgreich gesendet.",
      userId: inviteData.user?.id,
    },
    { status: 201 }
  )
}
