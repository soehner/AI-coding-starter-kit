import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { backupCodeVerifySchema } from "@/lib/validations/mfa"

/**
 * POST /api/auth/mfa/backup-codes/verify
 * Prüft ob ein Backup-Code gültig ist.
 * Markiert den Code bei Erfolg als verwendet und setzt ein signiertes MFA-Cookie.
 */
export async function POST(request: Request) {
  // Benutzer-Session prüfen
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

  // DB-basiertes Rate Limiting prüfen
  const adminSupabase = createAdminSupabaseClient()
  const { data: rateLimit } = await adminSupabase
    .from("mfa_rate_limits")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (rateLimit?.gesperrt_bis) {
    const gesperrtBis = new Date(rateLimit.gesperrt_bis)
    if (new Date() < gesperrtBis) {
      return NextResponse.json(
        {
          error: "Zu viele fehlgeschlagene Versuche. Bitte warten Sie 15 Minuten.",
          gesperrtBis: gesperrtBis.toISOString(),
        },
        { status: 429 }
      )
    }
  }

  // Eingabe validieren
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 }
    )
  }

  const parsed = backupCodeVerifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Ungültige Eingabe." },
      { status: 400 }
    )
  }

  const { code } = parsed.data

  // Alle nicht verwendeten Backup-Codes des Benutzers laden
  const { data: backupCodes, error: fetchError } = await adminSupabase
    .from("mfa_backup_codes")
    .select("id, code_hash")
    .eq("user_id", user.id)
    .is("used_at", null)

  if (fetchError) {
    console.error("Fehler beim Laden der Backup-Codes:", fetchError)
    return NextResponse.json(
      { error: "Backup-Codes konnten nicht geprüft werden." },
      { status: 500 }
    )
  }

  if (!backupCodes || backupCodes.length === 0) {
    return NextResponse.json(
      { error: "Keine gültigen Backup-Codes vorhanden." },
      { status: 400 }
    )
  }

  // Jeden Code gegen den eingegebenen prüfen
  let matchedCodeId: string | null = null
  for (const backupCode of backupCodes) {
    const isMatch = await bcrypt.compare(code, backupCode.code_hash)
    if (isMatch) {
      matchedCodeId = backupCode.id
      break
    }
  }

  if (!matchedCodeId) {
    // Fehlversuch in DB zählen
    const neueFehlversuche = (rateLimit?.fehlversuche ?? 0) + 1
    const jetzt = new Date().toISOString()
    const gesperrtBis = neueFehlversuche >= 5
      ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
      : null

    if (rateLimit) {
      await adminSupabase
        .from("mfa_rate_limits")
        .update({ fehlversuche: neueFehlversuche, gesperrt_bis: gesperrtBis, zuletzt_versucht_am: jetzt })
        .eq("id", rateLimit.id)
    } else {
      await adminSupabase.from("mfa_rate_limits").insert({
        user_id: user.id,
        ip_address: "backup-code",
        fehlversuche: neueFehlversuche,
        gesperrt_bis: gesperrtBis,
        zuletzt_versucht_am: jetzt,
      })
    }

    if (gesperrtBis) {
      return NextResponse.json(
        {
          error: "Zu viele fehlgeschlagene Versuche. Bitte warten Sie 15 Minuten.",
          gesperrtBis,
          gesperrt: true,
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: "Ungültiger Backup-Code.", verbleibendeVersuche: 5 - neueFehlversuche },
      { status: 401 }
    )
  }

  // Code als verwendet markieren
  await adminSupabase
    .from("mfa_backup_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", matchedCodeId)

  // Rate-Limit zurücksetzen
  if (rateLimit) {
    await adminSupabase
      .from("mfa_rate_limits")
      .update({ fehlversuche: 0, gesperrt_bis: null, zuletzt_versucht_am: new Date().toISOString() })
      .eq("id", rateLimit.id)
  }

  // Signiertes MFA-Backup-Cookie erstellen
  const payload = `${user.id}:${Date.now()}`
  const payloadB64 = Buffer.from(payload).toString("base64")
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex")
  const cookieValue = `${payloadB64}.${signature}`

  // Verbleibende Codes zählen
  const verbleibend = backupCodes.length - 1

  const response = NextResponse.json({
    success: true,
    verbleibendeCodes: verbleibend,
    hinweis:
      verbleibend <= 2
        ? `Achtung: Nur noch ${verbleibend} Backup-Code(s) übrig. Generieren Sie nach der Anmeldung neue Codes.`
        : undefined,
  })

  // Sicheres HTTP-only Cookie setzen (24h gültig)
  response.cookies.set("mfa_backup_verified", cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60, // 24 Stunden
  })

  return response
}
