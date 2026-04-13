import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { psd2ConnectSchema } from "@/lib/validations/psd2"
import {
  startAuth,
  deleteSession,
} from "@/lib/psd2/enablebanking-client"
import { randomBytes } from "crypto"

/**
 * POST /api/admin/psd2/connect
 * Startet den Enable-Banking-Consent-Flow (BBBank) und gibt die
 * Redirect-URL zurück, zu der der Kassenwart weitergeleitet werden muss.
 *
 * Sicherheitshinweis: Wir generieren ein kryptografisches State-Token und
 * speichern es in psd2_verbindungen. Im Callback (siehe callback/route.ts)
 * wird das `state` des Redirects gegen diesen Wert verglichen (CSRF-Schutz).
 */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // Body ist optional
  }

  const validation = psd2ConnectSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Ungültige Eingabe." },
      { status: 400 }
    )
  }

  const aspspName =
    validation.data.aspsp_name ??
    process.env.ENABLEBANKING_ASPSP_NAME ??
    "BBBank"
  const aspspCountry =
    validation.data.aspsp_country ??
    process.env.ENABLEBANKING_ASPSP_COUNTRY ??
    "DE"

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  const redirectUrl = `${baseUrl}/api/admin/psd2/callback`

  // State-Token generieren (32 Bytes → 64 Hex-Zeichen)
  const stateToken = randomBytes(32).toString("hex")

  // Consent-Gültigkeit bestimmen (Env oder Default 180 Tage)
  const consentTage = Number(process.env.ENABLEBANKING_CONSENT_TAGE) || 180
  const validUntil = new Date()
  validUntil.setUTCDate(validUntil.getUTCDate() + consentTage)
  const validUntilIso = validUntil.toISOString()

  try {
    const authStart = await startAuth({
      aspspName,
      aspspCountry,
      redirectUrl,
      stateToken,
      validUntilIso,
    })

    const adminClient = createAdminSupabaseClient()
    const { error: insertError } = await adminClient
      .from("psd2_verbindungen")
      .insert({
        enablebanking_authorization_id: authStart.authorization_id,
        enablebanking_session_id: null,
        enablebanking_account_id: null,
        enablebanking_aspsp_name: aspspName,
        enablebanking_aspsp_country: aspspCountry,
        // consent_gueltig_bis wird im Callback gesetzt, sobald die Session
        // tatsächlich existiert — vorher kennen wir den echten Wert nicht.
        consent_gueltig_bis: null,
        state_token: stateToken,
        state_token_erstellt_am: new Date().toISOString(),
        erstellt_von: auth.profile.id,
      })

    if (insertError) {
      return NextResponse.json(
        {
          error: `Verbindung konnte nicht gespeichert werden: ${insertError.message}`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: "Consent-Flow gestartet.",
        link: authStart.url,
        authorization_id: authStart.authorization_id,
      },
      { status: 201 }
    )
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Enable-Banking-Fehler: ${err.message}`
            : "Unbekannter Fehler beim Starten des Consent-Flows.",
      },
      { status: 502 }
    )
  }
}

/**
 * DELETE /api/admin/psd2/connect
 * Trennt die aktuelle Bankverbindung. Bereits importierte Daten bleiben erhalten.
 */
export async function DELETE() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const adminClient = createAdminSupabaseClient()

  const { data: verbindung } = await adminClient
    .from("psd2_verbindungen")
    .select("id, enablebanking_session_id")
    .order("erstellt_am", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!verbindung) {
    return NextResponse.json(
      { error: "Keine aktive Bankverbindung gefunden." },
      { status: 404 }
    )
  }

  // Best-Effort bei Enable Banking abmelden; Fehler tolerieren
  if (verbindung.enablebanking_session_id) {
    try {
      await deleteSession(verbindung.enablebanking_session_id as string)
    } catch (err) {
      console.warn(
        "Enable-Banking-Session konnte nicht gelöscht werden:",
        err instanceof Error ? err.message : err
      )
    }
  }

  const { error: deleteError } = await adminClient
    .from("psd2_verbindungen")
    .delete()
    .eq("id", verbindung.id)

  if (deleteError) {
    return NextResponse.json(
      {
        error: `Verbindung konnte nicht gelöscht werden: ${deleteError.message}`,
      },
      { status: 500 }
    )
  }

  // Suppress unused import/auth warning
  void auth

  return NextResponse.json({
    message: "Bankverbindung erfolgreich getrennt.",
  })
}
