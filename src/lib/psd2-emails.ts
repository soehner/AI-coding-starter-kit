import { Resend } from "resend"

/**
 * PROJ-16: E-Mails rund um den PSD2-Bankabruf.
 * Verwendet dasselbe Muster wie approval-emails.ts.
 */

let resendInstance: Resend | null = null

function getResend(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error(
        "RESEND_API_KEY ist nicht gesetzt. Bitte in .env.local konfigurieren."
      )
    }
    resendInstance = new Resend(apiKey)
  }
  return resendInstance
}

function getFromEmail(): string {
  const from = process.env.RESEND_FROM_EMAIL
  if (!from) {
    throw new Error(
      "RESEND_FROM_EMAIL ist nicht gesetzt. Bitte in .env.local konfigurieren."
    )
  }
  return from
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * Sendet eine Erinnerungs-E-Mail, wenn die PSD2-Zustimmung in den naechsten
 * Tagen ablaeuft.
 */
export async function sendeConsentRenewalEmail(params: {
  empfaenger: string
  tageBisAblauf: number
  ablaufDatum: string
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()
  const link = `${getBaseUrl()}/dashboard/einstellungen#bankzugang`

  const safeLink = escapeHtml(link)
  const safeTage = escapeHtml(String(params.tageBisAblauf))
  const safeAblauf = escapeHtml(params.ablaufDatum)

  try {
    const { error: sendError } = await resend.emails.send({
      from: getFromEmail(),
      to: params.empfaenger,
      subject: `CBS-Finanz: Bankzugang läuft in ${params.tageBisAblauf} Tagen ab`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Bankzugang läuft bald ab</h2>
          <p>Hallo,</p>
          <p>
            der PSD2-Bankzugang für CBS-Finanz läuft in
            <strong>${safeTage} Tagen</strong> ab
            (am <strong>${safeAblauf}</strong>).
          </p>
          <p>
            Bitte erneuere die Zustimmung rechtzeitig, damit der automatische
            Abruf der Kontobewegungen ohne Unterbrechung weiterläuft.
          </p>
          <p style="margin: 30px 0;">
            <a href="${safeLink}"
               style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;"
               target="_blank" rel="noopener noreferrer">
              Jetzt erneuern
            </a>
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Diese E-Mail wurde automatisch vom CBS-Förderverein-System verschickt.
          </p>
        </div>
      `,
    })

    if (sendError) {
      return { success: false, error: sendError.message }
    }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unbekannter Fehler.",
    }
  }
}
