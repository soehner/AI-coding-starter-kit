import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { encrypt } from "@/lib/encryption"
import { settingsSchema } from "@/lib/validations/import"

/**
 * GET /api/admin/settings
 * Gibt den aktuellen KI-Provider und ob ein Token konfiguriert ist zurück.
 */
export async function GET() {
  const authResult = await requireAdmin()
  if (authResult.error) {
    return authResult.error
  }

  const adminClient = createAdminSupabaseClient()

  const { data: settings } = await adminClient
    .from("app_settings")
    .select("key, value")
    .in("key", ["ki_provider", "ki_token"])
    .limit(2)

  const providerSetting = settings?.find((s) => s.key === "ki_provider")
  const tokenSetting = settings?.find((s) => s.key === "ki_token")

  return NextResponse.json({
    provider: providerSetting?.value || "openai",
    hasToken: !!tokenSetting?.value,
  })
}

/**
 * POST /api/admin/settings
 * Speichert KI-Provider und optional den verschlüsselten API-Token.
 */
export async function POST(request: Request) {
  const authResult = await requireAdmin()
  if (authResult.error) {
    return authResult.error
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 }
    )
  }

  const validation = settingsSchema.safeParse(body)
  if (!validation.success) {
    const firstError =
      validation.error.issues[0]?.message ?? "Ungültige Eingabe."
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { provider, token } = validation.data
  const { profile } = authResult
  const adminClient = createAdminSupabaseClient()

  // Provider speichern
  const { error: providerError } = await adminClient
    .from("app_settings")
    .upsert(
      {
        key: "ki_provider",
        value: provider,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )

  if (providerError) {
    console.error("Fehler beim Speichern des Providers:", providerError.message)
    return NextResponse.json(
      { error: "Provider konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }

  // Token speichern (wenn angegeben)
  if (token) {
    const encryptedToken = encrypt(token)

    const { error: tokenError } = await adminClient
      .from("app_settings")
      .upsert(
        {
          key: "ki_token",
          value: encryptedToken,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      )

    if (tokenError) {
      console.error("Fehler beim Speichern des Tokens:", tokenError.message)
      return NextResponse.json(
        { error: "Token konnte nicht gespeichert werden." },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    message: "Einstellungen erfolgreich gespeichert.",
    provider,
  })
}
