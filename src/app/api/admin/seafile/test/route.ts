import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { decrypt } from "@/lib/encryption"
import { testSeafileConnection } from "@/lib/seafile"
import { seafileTestSchema } from "@/lib/validations/seafile"

/**
 * POST /api/admin/seafile/test
 * Testet die Seafile-Verbindung.
 * Wenn kein Token im Body, wird der gespeicherte Token verwendet.
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

  const validation = seafileTestSchema.safeParse(body)
  if (!validation.success) {
    const firstError =
      validation.error.issues[0]?.message ?? "Ungültige Eingabe."
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { url, token: newToken, repo_id } = validation.data

  let tokenToUse = newToken

  // Falls kein neuer Token, den gespeicherten verwenden
  if (!tokenToUse) {
    const adminClient = createAdminSupabaseClient()
    const { data: tokenSetting } = await adminClient
      .from("app_settings")
      .select("value")
      .eq("key", "seafile_token")
      .single()

    if (!tokenSetting?.value) {
      return NextResponse.json(
        { error: "Kein Seafile-Token konfiguriert. Bitte zuerst einen Token speichern." },
        { status: 400 }
      )
    }

    try {
      tokenToUse = decrypt(tokenSetting.value)
    } catch {
      return NextResponse.json(
        { error: "Gespeicherter Seafile-Token konnte nicht entschlüsselt werden." },
        { status: 500 }
      )
    }
  }

  const result = await testSeafileConnection({
    url,
    token: tokenToUse,
    repoId: repo_id,
  })

  if (!result.success) {
    return NextResponse.json(
      { error: result.message },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    message: result.message,
  })
}
