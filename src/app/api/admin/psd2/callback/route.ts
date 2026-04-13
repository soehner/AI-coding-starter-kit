import { NextResponse } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { createSession } from "@/lib/psd2/enablebanking-client"

/**
 * GET /api/admin/psd2/callback
 *
 * Enable Banking leitet den Benutzer nach der Bankzustimmung hierher zurück
 * mit den Query-Parametern ?code=...&state=...
 *
 * Ablauf:
 *  1. State-Token gegen psd2_verbindungen.state_token abgleichen (CSRF-Schutz,
 *     M2-Fix). Das Token muss existieren, übereinstimmen UND darf nicht älter
 *     als 15 Minuten sein.
 *  2. Authorisierungs-Code via POST /sessions in eine Session umwandeln.
 *  3. Das erste Konto der Session übernehmen (Vereinskonto).
 *  4. Session-ID, Account-ID und Consent-Ablaufdatum persistieren.
 *  5. State-Token nullen (Einmal-Verwendung).
 *  6. Redirect zurück in die Einstellungen.
 */
export async function GET(request: Request) {
  // Kein requireAdmin() hier: Enable Banking ruft uns als externer HTTP-Redirect
  // auf, und die Supabase-Session des Kassenwarts ist zu diesem Zeitpunkt
  // möglicherweise bereits abgelaufen (der Besuch bei der Bank dauert Minuten).
  // Der CSRF-Schutz läuft über den einmalig gültigen, 15-Minuten-befristeten
  // state_token, den wir beim /connect-Aufruf generiert haben.
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const errorParam = url.searchParams.get("error")

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  const fehlerRedirect = (msg: string) =>
    NextResponse.redirect(
      `${baseUrl}/dashboard/einstellungen?psd2=error&msg=${encodeURIComponent(msg)}`
    )

  if (errorParam) {
    return fehlerRedirect(errorParam)
  }

  if (!code || !state) {
    return fehlerRedirect("Callback unvollständig: code oder state fehlen.")
  }

  const adminClient = createAdminSupabaseClient()

  // M2-Fix: Zeile via state_token finden (CSRF-geschützt, kein ORDER BY-Trick)
  const { data: verbindung } = await adminClient
    .from("psd2_verbindungen")
    .select("*")
    .eq("state_token", state)
    .maybeSingle()

  if (!verbindung) {
    return fehlerRedirect("Ungültiger oder bereits verbrauchter State-Token.")
  }

  // State-Token darf nicht älter als 15 Minuten sein
  if (verbindung.state_token_erstellt_am) {
    const erstellt = new Date(
      verbindung.state_token_erstellt_am as string
    ).getTime()
    const alterMinuten = (Date.now() - erstellt) / (1000 * 60)
    if (alterMinuten > 15) {
      // Token abgelaufen → löschen und Fehler zurückgeben
      await adminClient
        .from("psd2_verbindungen")
        .update({ state_token: null, state_token_erstellt_am: null })
        .eq("id", verbindung.id)
      return fehlerRedirect(
        "State-Token abgelaufen (älter als 15 Minuten). Bitte erneut verbinden."
      )
    }
  }

  try {
    const session = await createSession(code)

    if (!session.accounts || session.accounts.length === 0) {
      return fehlerRedirect("Keine Konten von Enable Banking erhalten.")
    }

    // Nur das erste Konto übernehmen (Spec: nur ein Vereinskonto).
    // Falls mehrere gelistet sind: zusätzliche Konten loggen, aber nicht
    // speichern.
    if (session.accounts.length > 1) {
      console.log(
        "Enable Banking lieferte mehrere Konten, es wird nur das erste verwendet:",
        session.accounts.map((a) => ({
          uid: a.uid,
          iban: a.iban ?? a.account_id?.iban ?? null,
        }))
      )
    }
    const account = session.accounts[0]
    const accountUid = account.uid

    // Consent-Ablauf aus Session ziehen, sonst Fallback auf Default
    let ablaufDatum: string | null = null
    if (session.access?.valid_until) {
      ablaufDatum = session.access.valid_until.slice(0, 10)
    } else {
      const consentTage = Number(process.env.ENABLEBANKING_CONSENT_TAGE) || 180
      const d = new Date()
      d.setUTCDate(d.getUTCDate() + consentTage)
      ablaufDatum = d.toISOString().slice(0, 10)
    }

    const { error: updateError } = await adminClient
      .from("psd2_verbindungen")
      .update({
        enablebanking_session_id: session.session_id,
        enablebanking_account_id: accountUid,
        consent_gueltig_bis: ablaufDatum,
        // State-Token invalidieren (Einmal-Verwendung)
        state_token: null,
        state_token_erstellt_am: null,
      })
      .eq("id", verbindung.id)

    if (updateError) {
      return fehlerRedirect(`Update fehlgeschlagen: ${updateError.message}`)
    }

    return NextResponse.redirect(
      `${baseUrl}/dashboard/einstellungen?psd2=success`
    )
  } catch (err) {
    const meldung =
      err instanceof Error ? err.message : "Unbekannter Enable-Banking-Fehler."
    return fehlerRedirect(meldung)
  }
}
