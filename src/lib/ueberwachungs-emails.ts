import { Resend } from "resend"

/**
 * PROJ-18: E-Mail-Benachrichtigung bei einem Treffer einer Überwachungsregel.
 * Folgt demselben Muster wie psd2-emails.ts / approval-emails.ts.
 *
 * Der Versand erfolgt pro Empfänger isoliert: Schlägt eine Adresse fehl,
 * erhalten die übrigen Empfänger die Mail trotzdem.
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

function getReplyToEmail(): string {
  return process.env.RESEND_REPLY_TO_EMAIL || "soeh@cbs-mannheim.de"
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
})

function formatDatum(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

export interface UeberwachungsEmailBuchung {
  datum: string
  betrag: number
  gegenseite: string | null
  verwendungszweck: string
}

export interface SendeUeberwachungsEmailParams {
  empfaenger: string[]
  regelName: string
  zusammenfassung: string
  buchungen: UeberwachungsEmailBuchung[]
}

export interface SendeUeberwachungsEmailErgebnis {
  versendetAn: string[]
  fehler: string[]
}

/**
 * Versendet die Benachrichtigung an alle Empfänger einer Regel.
 * Alle daten-/benutzerseitigen Werte werden HTML-escaped.
 */
export async function sendeUeberwachungsEmail(
  params: SendeUeberwachungsEmailParams
): Promise<SendeUeberwachungsEmailErgebnis> {
  const resend = getResend()
  const from = getFromEmail()
  const replyTo = getReplyToEmail()

  const safeRegelName = escapeHtml(params.regelName)
  const safeZusammenfassung = escapeHtml(params.zusammenfassung)

  const zeilen = params.buchungen
    .map((b) => {
      const betragFarbe = b.betrag < 0 ? "#b91c1c" : "#15803d"
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; white-space: nowrap;">${escapeHtml(
            formatDatum(b.datum)
          )}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: right; white-space: nowrap; color: ${betragFarbe}; font-weight: bold;">${escapeHtml(
            euroFormatter.format(b.betrag)
          )}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${escapeHtml(
            b.gegenseite ?? "—"
          )}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${escapeHtml(
            b.verwendungszweck
          )}</td>
        </tr>`
    })
    .join("")

  const anzahl = params.buchungen.length
  const subjectZusatz =
    anzahl > 1 ? ` (${anzahl} Buchungen)` : ""

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a;">Überwachungsregel ausgelöst</h2>
      <p>Hallo,</p>
      <p>
        die Überwachungsregel <strong>${safeRegelName}</strong> hat bei einem
        automatischen Bankabruf angeschlagen.
      </p>
      <p style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 10px 14px; color: #334155;">
        <strong>Was diese Regel prüft:</strong><br>${safeZusammenfassung}
      </p>
      <h3 style="color: #1a1a1a; margin-top: 24px;">Betroffene Buchung${
        anzahl > 1 ? "en" : ""
      }</h3>
      <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left;">
            <th style="padding: 8px 12px;">Datum</th>
            <th style="padding: 8px 12px; text-align: right;">Betrag</th>
            <th style="padding: 8px 12px;">Gegenseite</th>
            <th style="padding: 8px 12px;">Verwendungszweck</th>
          </tr>
        </thead>
        <tbody>${zeilen}</tbody>
      </table>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Diese E-Mail wurde automatisch vom CBS-Förderverein-System verschickt,
        weil eine von dir bzw. dem Kassenwart konfigurierte Überwachungsregel
        zugetroffen hat.
      </p>
    </div>
  `

  const subject = `CBS-Finanz: Überwachungsregel „${params.regelName}" ausgelöst${subjectZusatz}`

  const versendetAn: string[] = []
  const fehler: string[] = []

  for (const adresse of params.empfaenger) {
    try {
      const { error } = await resend.emails.send({
        from,
        replyTo,
        to: adresse,
        subject,
        html,
      })
      if (error) {
        fehler.push(adresse)
        console.error(
          `Überwachungs-Mail an ${adresse} fehlgeschlagen:`,
          error.message
        )
      } else {
        versendetAn.push(adresse)
      }
    } catch (err) {
      fehler.push(adresse)
      console.error(
        `Überwachungs-Mail an ${adresse} fehlgeschlagen:`,
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  return { versendetAn, fehler }
}
