/**
 * PROJ-17: E-Mail-Versand für Spendenquittungen via Resend.
 * Verwendet dasselbe Setup wie PROJ-2 (Invites) und PROJ-10 (Genehmigungen).
 */
import { Resend } from "resend"

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

interface SendQuittungEmailParams {
  empfaenger: string
  betreff: string
  text: string
  pdfBuffer: Buffer
  pdfDateiname: string
  /** Optionale CC-Empfänger (z. B. 1./2. Vorsitzender). */
  cc?: string[]
}

/**
 * Sendet die Quittung als PDF-Anhang per E-Mail an den Spender.
 *
 * @returns Ergebnis-Objekt; `success: false` führt im Aufrufer dazu, dass
 *   `email_versendet_am` NICHT gesetzt wird – die Quittung bleibt aber in
 *   der Datenbank, der Versand kann später erneut ausgelöst werden.
 */
export async function sendeSpendenquittungEmail(
  params: SendQuittungEmailParams
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()

  const safeText = escapeHtml(params.text).replace(/\n/g, "<br>")

  try {
    const ccList = (params.cc ?? []).filter(
      (addr) => addr && addr.toLowerCase() !== params.empfaenger.toLowerCase()
    )

    const { error: sendError } = await resend.emails.send({
      from: getFromEmail(),
      to: params.empfaenger,
      cc: ccList.length > 0 ? ccList : undefined,
      subject: params.betreff,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="white-space: pre-line; line-height: 1.5;">${safeText}</div>
          <p style="color: #666; font-size: 12px; margin-top: 32px;">
            CBS-Mannheim Förderverein
          </p>
        </div>
      `,
      attachments: [
        {
          filename: params.pdfDateiname,
          content: params.pdfBuffer,
        },
      ],
    })

    if (sendError) {
      console.error(
        `Spendenquittungs-E-Mail an ${params.empfaenger} fehlgeschlagen:`,
        sendError
      )
      return { success: false, error: sendError.message }
    }
    return { success: true }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler"
    console.error(
      `Spendenquittungs-E-Mail an ${params.empfaenger} fehlgeschlagen:`,
      message
    )
    return { success: false, error: message }
  }
}

/**
 * Erzeugt den Standard-Betreff und -Text für die initiale E-Mail.
 * Der Admin kann beides im Dialog überschreiben.
 */
export function defaultEmailVorlage(params: {
  spenderName: string
  vereinName: string
  quittungNummer: string
  betrag: number
  spendeDatum: string
}): { betreff: string; text: string } {
  const betragFormatiert = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(params.betrag)

  const [yyyy, mm, dd] = params.spendeDatum.split("-")
  const spendeDatumDe = `${dd}.${mm}.${yyyy}`

  return {
    betreff: `Ihre Zuwendungsbestätigung vom ${params.vereinName}`,
    text:
      `Sehr geehrte Damen und Herren,\n\n` +
      `vielen Dank für Ihre Spende in Höhe von ${betragFormatiert} EUR ` +
      `vom ${spendeDatumDe}.\n\n` +
      `Im Anhang finden Sie Ihre Zuwendungsbestätigung ` +
      `(Quittungs-Nr. ${params.quittungNummer}) zur Vorlage bei Ihrem ` +
      `Finanzamt.\n\n` +
      `Mit freundlichen Grüßen\n` +
      `${params.vereinName}`,
  }
}
