import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { encrypt } from "@/lib/encryption"
import { settingsSchema } from "@/lib/validations/import"
import { seafileSettingsSchema } from "@/lib/validations/seafile"

/** Alle Seafile-Schlüssel in app_settings */
const SEAFILE_KEYS = [
  "seafile_url",
  "seafile_token",
  "seafile_repo_id",
  "seafile_receipt_path",
  "seafile_statement_path",
] as const

/** Alle Schlüssel, die in GET zurückgegeben werden */
const ALL_SETTING_KEYS = ["ki_provider", "ki_token", ...SEAFILE_KEYS] as const

/**
 * GET /api/admin/settings
 * Gibt KI- und Seafile-Einstellungen zurück.
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
    .in("key", ALL_SETTING_KEYS as unknown as string[])
    .limit(ALL_SETTING_KEYS.length)

  const getValue = (key: string) =>
    settings?.find((s) => s.key === key)?.value || ""

  return NextResponse.json({
    // KI-Einstellungen (bestehend)
    provider: getValue("ki_provider") || "openai",
    hasToken: !!getValue("ki_token"),
    // Seafile-Einstellungen (neu)
    seafile_url: getValue("seafile_url"),
    hasSeafileToken: !!getValue("seafile_token"),
    seafile_repo_id: getValue("seafile_repo_id"),
    seafile_receipt_path: getValue("seafile_receipt_path"),
    seafile_statement_path: getValue("seafile_statement_path"),
  })
}

/**
 * POST /api/admin/settings
 * Speichert KI- und/oder Seafile-Einstellungen.
 * Erkennt automatisch anhand der Felder, was gespeichert werden soll.
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

  const rawBody = body as Record<string, unknown>
  const isSeafileRequest = "seafile_url" in rawBody || "seafile_repo_id" in rawBody
  const isKiRequest = "provider" in rawBody

  if (!isSeafileRequest && !isKiRequest) {
    return NextResponse.json(
      { error: "Keine erkennbaren Einstellungen im Request." },
      { status: 400 }
    )
  }

  const { profile } = authResult
  const adminClient = createAdminSupabaseClient()

  // --- KI-Einstellungen speichern ---
  if (isKiRequest) {
    const validation = settingsSchema.safeParse(body)
    if (!validation.success) {
      const firstError =
        validation.error.issues[0]?.message ?? "Ungültige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { provider, token } = validation.data

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

  // --- Seafile-Einstellungen speichern ---
  if (isSeafileRequest) {
    const validation = seafileSettingsSchema.safeParse(body)
    if (!validation.success) {
      const firstError =
        validation.error.issues[0]?.message ?? "Ungültige Eingabe."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const data = validation.data
    const timestamp = new Date().toISOString()

    // Nicht-Token-Felder direkt speichern
    const plainFields: { key: string; value: string }[] = [
      { key: "seafile_url", value: data.seafile_url },
      { key: "seafile_repo_id", value: data.seafile_repo_id },
      { key: "seafile_receipt_path", value: data.seafile_receipt_path },
      { key: "seafile_statement_path", value: data.seafile_statement_path },
    ]

    for (const field of plainFields) {
      const { error } = await adminClient
        .from("app_settings")
        .upsert(
          {
            key: field.key,
            value: field.value,
            updated_by: profile.id,
            updated_at: timestamp,
          },
          { onConflict: "key" }
        )

      if (error) {
        console.error(`Fehler beim Speichern von ${field.key}:`, error.message)
        return NextResponse.json(
          { error: `${field.key} konnte nicht gespeichert werden.` },
          { status: 500 }
        )
      }
    }

    // Token verschlüsselt speichern (nur wenn angegeben)
    if (data.seafile_token) {
      const encryptedToken = encrypt(data.seafile_token)
      const { error: tokenError } = await adminClient
        .from("app_settings")
        .upsert(
          {
            key: "seafile_token",
            value: encryptedToken,
            updated_by: profile.id,
            updated_at: timestamp,
          },
          { onConflict: "key" }
        )

      if (tokenError) {
        console.error("Fehler beim Speichern des Seafile-Tokens:", tokenError.message)
        return NextResponse.json(
          { error: "Seafile-Token konnte nicht gespeichert werden." },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      message: "Seafile-Einstellungen erfolgreich gespeichert.",
    })
  }
}
