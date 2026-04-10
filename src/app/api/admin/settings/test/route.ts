import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { decrypt } from "@/lib/encryption"
import { testApiToken } from "@/lib/ki-parser"
import { testTokenSchema } from "@/lib/validations/import"
import type { KiProvider } from "@/lib/types"

/**
 * POST /api/admin/settings/test
 * Testet ob ein API-Token gültig ist.
 * Wenn kein Token im Body, wird der gespeicherte Token getestet.
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

  const validation = testTokenSchema.safeParse(body)
  if (!validation.success) {
    const firstError =
      validation.error.issues[0]?.message ?? "Ungültige Eingabe."
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { provider, token: newToken } = validation.data

  let tokenToTest = newToken

  // Falls kein neuer Token, den gespeicherten verwenden
  if (!tokenToTest) {
    const adminClient = createAdminSupabaseClient()
    const { data: tokenSetting } = await adminClient
      .from("app_settings")
      .select("value")
      .eq("key", "ki_token")
      .single()

    if (!tokenSetting?.value) {
      return NextResponse.json(
        { error: "Kein API-Token konfiguriert. Bitte zuerst einen Token speichern." },
        { status: 400 }
      )
    }

    try {
      tokenToTest = decrypt(tokenSetting.value)
    } catch {
      return NextResponse.json(
        { error: "Gespeicherter Token konnte nicht entschlüsselt werden." },
        { status: 500 }
      )
    }
  }

  const result = await testApiToken(provider as KiProvider, tokenToTest)

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
