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

const ROLE_LABELS: Record<string, string> = {
  vorstand: "Vorstand",
  zweiter_vorstand: "2. Vorstand",
}

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
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
 * Liefert eine sichere URL für HTML-Attribute.
 * Nur https-Links werden akzeptiert. Bei ungültigen URLs wird "#" zurückgegeben,
 * damit niemals `javascript:` oder andere gefährliche Schemata im href landen.
 *
 * BUG-8 / BUG-12
 */
function safeHref(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:") return "#"
    return escapeHtml(url)
  } catch {
    return "#"
  }
}

interface ApprovalRequestEmailParams {
  recipientEmail: string
  recipientRoleLabel: string
  requesterEmail: string
  note: string
  documents: Array<{ url: string; name: string }>
  createdAt: string
  decisionUrl: string
}

/**
 * E-Mail an einen Genehmiger mit Genehmigen/Ablehnen-Link.
 */
export async function sendApprovalRequestEmail(
  params: ApprovalRequestEmailParams
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()

  const safeNote = escapeHtml(params.note).replace(/\n/g, "<br>")
  const safeRequester = escapeHtml(params.requesterEmail)
  const safeRoleLabel = escapeHtml(params.recipientRoleLabel)

  // BUG-8 / BUG-12: URLs sicher escapen (nur https)
  const approveHref = safeHref(`${params.decisionUrl}?aktion=genehmigen`)
  const rejectHref = safeHref(`${params.decisionUrl}?aktion=ablehnen`)

  const docsListHtml = params.documents
    .map(
      (doc) =>
        `<li style="margin: 2px 0;"><a href="${safeHref(doc.url)}" style="color: #2563eb;" target="_blank" rel="noopener noreferrer">${escapeHtml(doc.name)}</a></li>`
    )
    .join("")
  const belegLabel = params.documents.length > 1 ? "Belege" : "Beleg"

  try {
    const { error: sendError } = await resend.emails.send({
      from: getFromEmail(),
      to: params.recipientEmail,
      subject: `Genehmigungsanfrage vom CBS-Förderverein`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Neue Genehmigungsanfrage</h2>

          <p>Hallo,</p>

          <p>du wurdest als <strong>${safeRoleLabel}</strong> um eine Entscheidung gebeten.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="border-bottom: 1px solid #e5e5e5;">
              <td style="padding: 8px 0; font-weight: bold; color: #666; width: 140px;">Antragsteller</td>
              <td style="padding: 8px 0;">${safeRequester}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e5e5;">
              <td style="padding: 8px 0; font-weight: bold; color: #666;">Eingereicht am</td>
              <td style="padding: 8px 0;">${formatDate(params.createdAt)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e5e5;">
              <td style="padding: 8px 0; font-weight: bold; color: #666; vertical-align: top;">Bemerkung</td>
              <td style="padding: 8px 0;">${safeNote}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #666; vertical-align: top;">${belegLabel}</td>
              <td style="padding: 8px 0;">
                <ul style="margin: 0; padding-left: 18px;">${docsListHtml}</ul>
              </td>
            </tr>
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
            Die Buttons öffnen die Entscheidungsseite. Dort kannst du optional einen Kommentar hinzufügen und bestätigen.
          </p>

          <p style="color: #666; font-size: 13px; margin-top: 32px;">
            Dieser Link ist 7 Tage gültig und kann nur einmal verwendet werden.<br>
            CBS-Mannheim Förderverein – Genehmigungssystem
          </p>
        </div>
      `,
    })
    if (sendError) {
      console.error(
        `Genehmigungs-E-Mail an ${params.recipientEmail} fehlgeschlagen:`,
        sendError
      )
      return { success: false, error: sendError.message }
    }
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler"
    console.error(
      `Genehmigungs-E-Mail an ${params.recipientEmail} fehlgeschlagen:`,
      message
    )
    return { success: false, error: message }
  }
}

interface FinalDecisionEmailParams {
  recipientEmail: string
  finalDecision: "genehmigt" | "abgelehnt"
  note: string
  decisions: Array<{ role: string; decision: string; comment: string | null }>
}

/**
 * E-Mail an den Antragsteller mit dem Endergebnis.
 */
export async function sendDecisionNotificationEmail(
  params: FinalDecisionEmailParams
): Promise<void> {
  const resend = getResend()
  const baseUrl = getBaseUrl()

  const safeNote = escapeHtml(params.note).replace(/\n/g, "<br>")
  const decisionColor = params.finalDecision === "genehmigt" ? "#16a34a" : "#dc2626"

  const decisionSummary = params.decisions
    .map((d) => {
      const label = ROLE_LABELS[d.role] || d.role
      const icon = d.decision === "genehmigt" ? "✓" : "✗"
      const color = d.decision === "genehmigt" ? "#16a34a" : "#dc2626"
      const commentLine = d.comment
        ? `<div style="color: #666; font-size: 13px; margin-top: 2px;">„${escapeHtml(d.comment)}"</div>`
        : ""
      return `
        <tr>
          <td style="padding: 6px 12px 6px 0; vertical-align: top;">${escapeHtml(label)}</td>
          <td style="padding: 6px 0; color: ${color};">
            ${icon} ${d.decision}
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
      subject: `Dein Genehmigungsantrag wurde ${params.finalDecision}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Entscheidung zu deinem Antrag</h2>

          <p>Hallo,</p>

          <p>dein Genehmigungsantrag wurde
          <strong style="color: ${decisionColor}; font-size: 18px;">
            ${params.finalDecision}
          </strong>.</p>

          <div style="background: #f5f5f5; padding: 12px 16px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0 0 4px; font-size: 13px; color: #666;">Deine Bemerkung:</p>
            <p style="margin: 0;">${safeNote}</p>
          </div>

          <h3 style="margin-top: 24px;">Entscheidungen im Detail</h3>
          <table style="border-collapse: collapse; width: 100%;">${decisionSummary}</table>

          <p style="margin-top: 24px;">
            <a href="${safeHref(`${baseUrl}/dashboard/admin/genehmigungen`)}" style="color: #2563eb;">
              Zur Antragsübersicht
            </a>
          </p>

          <p style="color: #666; font-size: 13px; margin-top: 32px;">
            CBS-Mannheim Förderverein – Genehmigungssystem
          </p>
        </div>
      `,
    })
    if (sendError) {
      console.error(
        `Entscheidungs-E-Mail an ${params.recipientEmail} fehlgeschlagen:`,
        sendError
      )
    }
  } catch (error) {
    console.error(
      `Entscheidungs-E-Mail an ${params.recipientEmail} fehlgeschlagen:`,
      error
    )
  }
}

/**
 * Baut die öffentliche Entscheidungs-URL (Frontend-Route).
 */
export function buildDecisionUrl(token: string): string {
  return `${getBaseUrl()}/genehmigung/${token}`
}
