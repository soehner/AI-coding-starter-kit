import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { inviteUserSchema } from "@/lib/validations/admin"
import { sendInvitationEmail, getSiteUrl } from "@/lib/email-invite"

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

  const { email, role, ist_vorstand, ist_zweiter_vorstand } = validation.data
  const normalizedEmail = email.toLowerCase().trim()

  // 3. E-Mail-Dienst-Konfiguration prüfen, bevor ein User angelegt wird
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json(
      {
        error:
          "E-Mail-Dienst ist nicht konfiguriert. Bitte RESEND_API_KEY und RESEND_FROM_EMAIL setzen.",
      },
      { status: 500 }
    )
  }

  // 4. Prüfen ob E-Mail bereits existiert
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

  // 5. Einladungs-Link via Supabase Admin API erzeugen (ohne Mail-Versand)
  //    Wir verschicken die Mail selbst über Resend, damit externe Mail-Scanner
  //    (Outlook SafeLinks, Mimecast) den One-Time-Token nicht vorab verbrauchen
  //    und der User garantiert auf /invite/accept landet.
  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "invite",
      email: normalizedEmail,
      options: {
        data: { role },
      },
    })

  if (linkError || !linkData) {
    console.error("Einladungsfehler:", linkError?.message)

    if (linkError?.message.includes("already been registered")) {
      return NextResponse.json(
        { error: "Diese E-Mail-Adresse ist bereits registriert." },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        error:
          "Einladung konnte nicht erstellt werden. Bitte versuchen Sie es später erneut.",
      },
      { status: 500 }
    )
  }

  // 6. Eigene Bestätigungs-URL bauen (zeigt auf unseren /auth/confirm-Handler)
  const siteUrl = getSiteUrl()
  const tokenHash = linkData.properties?.hashed_token
  if (!tokenHash) {
    return NextResponse.json(
      { error: "Einladungs-Token konnte nicht erzeugt werden." },
      { status: 500 }
    )
  }
  const confirmUrl = `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(
    tokenHash
  )}&type=invite&next=${encodeURIComponent("/einladung-annehmen")}`

  // 7. Einladungs-Mail über Resend verschicken
  try {
    await sendInvitationEmail(normalizedEmail, confirmUrl, role)
  } catch (emailErr) {
    console.error("Einladungs-E-Mail fehlgeschlagen:", emailErr)
    // Mail fehlgeschlagen → angelegten User wieder aufräumen
    if (linkData.user?.id) {
      await adminClient.from("user_profiles").delete().eq("id", linkData.user.id)
      await adminClient.auth.admin.deleteUser(linkData.user.id)
    }
    return NextResponse.json(
      {
        error:
          emailErr instanceof Error
            ? emailErr.message
            : "E-Mail konnte nicht gesendet werden.",
      },
      { status: 500 }
    )
  }

  // 8. Rolle im user_profiles setzen (Trigger hat bereits einen Eintrag angelegt)
  if (linkData.user) {
    const { error: updateError } = await adminClient
      .from("user_profiles")
      .upsert({
        id: linkData.user.id,
        email: normalizedEmail,
        role: role,
        ist_vorstand: ist_vorstand ?? false,
        ist_zweiter_vorstand: ist_zweiter_vorstand ?? false,
      })

    if (updateError) {
      console.error("Fehler beim Setzen der Rolle:", updateError.message)
      // Einladung wurde trotzdem gesendet - Rolle kann später geändert werden
    }
  }

  return NextResponse.json(
    {
      message: "Einladung erfolgreich gesendet.",
      userId: linkData.user?.id,
    },
    { status: 201 }
  )
}
