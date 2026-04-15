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

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}

function formatEuro(cents: number): string {
  return (
    (cents / 100).toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function safeHref(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:") return "#"
    return escapeHtml(url)
  } catch {
    return "#"
  }
}

export function buildAntragDecisionUrl(token: string): string {
  return `${getBaseUrl()}/antrag/entscheidung/${token}`
}

interface AntragApprovalRequestEmailParams {
  recipientEmail: string
  applicantName: string
  applicantEmail: string
  amountCents: number
  purpose: string
  createdAt: string
  documents: Array<{ url: string; name: string }>
  decisionUrl: string
}

/**
 * E-Mail an einen Antrag-Genehmiger mit Genehmigen/Ablehnen-Link.
 */
export async function sendAntragApprovalRequestEmail(
  params: AntragApprovalRequestEmailParams
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()

  const safeApplicant = escapeHtml(params.applicantName)
  const safeApplicantEmail = escapeHtml(params.applicantEmail)
  const safePurpose = escapeHtml(params.purpose).replace(/\n/g, "<br>")
  const safeAmount = escapeHtml(formatEuro(params.amountCents))
  const approveHref = safeHref(`${params.decisionUrl}?aktion=genehmigen`)
  const rejectHref = safeHref(`${params.decisionUrl}?aktion=ablehnen`)

  const belegLabel = params.documents.length > 1 ? "Anhänge" : "Anhang"
  const docsRowHtml =
    params.documents.length === 0
      ? ""
      : `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #666; vertical-align: top;">${belegLabel}</td>
              <td style="padding: 8px 0;">
                <ul style="margin: 0; padding-left: 18px;">${params.documents
                  .map(
                    (doc) =>
                      `<li style="margin: 2px 0;"><a href="${safeHref(doc.url)}" style="color: #2563eb;" target="_blank" rel="noopener noreferrer">${escapeHtml(doc.name)}</a></li>`
                  )
                  .join("")}</ul>
              </td>
            </tr>`

  try {
    const { error: sendError } = await resend.emails.send({
      from: getFromEmail(),
      to: params.recipientEmail,
      subject: `Kostenübernahme-Antrag von ${params.applicantName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Neuer Antrag auf Kostenübernahme</h2>

          <p>Hallo,</p>

          <p>beim CBS-Mannheim Förderverein ist ein neuer Antrag auf Kostenübernahme eingegangen. Als eingetragenes Mitglied des Genehmiger-Pools bist du gebeten, darüber abzustimmen.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="border-bottom: 1px solid #e5e5e5;">
              <td style="padding: 8px 0; font-weight: bold; color: #666; width: 140px;">Antragsteller</td>
              <td style="padding: 8px 0;">${safeApplicant}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e5e5;">
              <td style="padding: 8px 0; font-weight: bold; color: #666;">E-Mail</td>
              <td style="padding: 8px 0;">${safeApplicantEmail}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e5e5;">
              <td style="padding: 8px 0; font-weight: bold; color: #666;">Eingereicht am</td>
              <td style="padding: 8px 0;">${formatDate(params.createdAt)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e5e5;">
              <td style="padding: 8px 0; font-weight: bold; color: #666;">Betrag</td>
              <td style="padding: 8px 0;"><strong>${safeAmount}</strong></td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e5e5;">
              <td style="padding: 8px 0; font-weight: bold; color: #666; vertical-align: top;">Verwendungszweck</td>
              <td style="padding: 8px 0;">${safePurpose}</td>
            </tr>
            ${docsRowHtml}
          </table>

          <p style="margin: 24px 0 8px;">Bitte triff deine Entscheidung:</p>

          <div style="margin: 20px 0;">
            <a href="${approveHref}"
               style="display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 8px;">
              Genehmigen
            </a>
            <a href="${rejectHref}"
               style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Nicht genehmigen
            </a>
          </div>

          <p style="color: #666; font-size: 13px; margin-top: 8px;">
            Die Buttons öffnen die Entscheidungsseite. Dort kannst du optional einen Kommentar hinzufügen und bestätigen. Die Entscheidung fällt per Mehrheit aller eingetragenen Genehmiger.
          </p>

          <p style="color: #666; font-size: 13px; margin-top: 32px;">
            Dieser Link ist 7 Tage gültig und kann nur einmal verwendet werden.<br>
            CBS-Mannheim Förderverein
          </p>
        </div>
      `,
    })
    if (sendError) {
      console.error(
        `Antrag-Genehmiger-E-Mail an ${params.recipientEmail} fehlgeschlagen:`,
        sendError
      )
      return { success: false, error: sendError.message }
    }
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler"
    console.error(
      `Antrag-Genehmiger-E-Mail an ${params.recipientEmail} fehlgeschlagen:`,
      message
    )
    return { success: false, error: message }
  }
}

interface AntragDecisionNotificationParams {
  recipientEmail: string
  applicantName: string
  amountCents: number
  purpose: string
  finalDecision: "genehmigt" | "abgelehnt"
  decisions: Array<{ approverEmail: string; decision: string; comment: string | null }>
}

/**
 * E-Mail an den Antragsteller mit dem Endergebnis.
 */
export async function sendAntragDecisionNotificationEmail(
  params: AntragDecisionNotificationParams
): Promise<void> {
  const resend = getResend()

  const safePurpose = escapeHtml(params.purpose).replace(/\n/g, "<br>")
  const safeApplicant = escapeHtml(params.applicantName)
  const safeAmount = escapeHtml(formatEuro(params.amountCents))
  const decisionColor =
    params.finalDecision === "genehmigt" ? "#16a34a" : "#dc2626"

  const decisionRows = params.decisions
    .map((d) => {
      const icon = d.decision === "genehmigt" ? "✓" : "✗"
      const color = d.decision === "genehmigt" ? "#16a34a" : "#dc2626"
      const commentLine = d.comment
        ? `<div style="color: #666; font-size: 13px; margin-top: 2px;">„${escapeHtml(d.comment)}"</div>`
        : ""
      return `
        <tr>
          <td style="padding: 6px 12px 6px 0; vertical-align: top;">${escapeHtml(d.approverEmail)}</td>
          <td style="padding: 6px 0; color: ${color};">
            ${icon} ${escapeHtml(d.decision)}
            ${commentLine}
          </td>
        </tr>
      `
    })
    .join("")

  try {
    const { error: sendError } = await resend.emails.send({
      from: getFromEmail(),
      to: params.recipientEmail,
      subject: `Dein Kostenübernahme-Antrag wurde ${params.finalDecision}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Entscheidung zu deinem Antrag</h2>

          <p>Hallo ${safeApplicant},</p>

          <p>dein Antrag auf Kostenübernahme wurde
          <strong style="color: ${decisionColor}; font-size: 18px;">
            ${params.finalDecision}
          </strong>.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="border-bottom: 1px solid #e5e5e5;">
              <td style="padding: 8px 0; font-weight: bold; color: #666; width: 140px;">Betrag</td>
              <td style="padding: 8px 0;">${safeAmount}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e5e5;">
              <td style="padding: 8px 0; font-weight: bold; color: #666; vertical-align: top;">Verwendungszweck</td>
              <td style="padding: 8px 0;">${safePurpose}</td>
            </tr>
          </table>

          <h3 style="margin-top: 24px;">Entscheidungen im Detail</h3>
          <table style="border-collapse: collapse; width: 100%;">${decisionRows}</table>

          <p style="color: #666; font-size: 13px; margin-top: 32px;">
            CBS-Mannheim Förderverein
          </p>
        </div>
      `,
    })
    if (sendError) {
      console.error(
        `Antragsteller-E-Mail an ${params.recipientEmail} fehlgeschlagen:`,
        sendError
      )
    }
  } catch (error) {
    console.error(
      `Antragsteller-E-Mail an ${params.recipientEmail} fehlgeschlagen:`,
      error
    )
  }
}
