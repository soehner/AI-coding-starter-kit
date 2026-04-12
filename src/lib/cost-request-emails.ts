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

function formatAmount(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100)
}

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}

const ROLE_LABELS: Record<string, string> = {
  vorsitzender_1: "1. Vorsitzender",
  vorsitzender_2: "2. Vorsitzender",
  kassier: "Kassier",
}

interface ApprovalEmailParams {
  recipientEmail: string
  recipientLabel: string
  applicantName: string
  amount: number
  purpose: string
  createdAt: string
  approveToken: string
  rejectToken: string
}

/**
 * Sendet die Genehmigungs-E-Mail an einen Genehmiger.
 */
export async function sendApprovalRequestEmail(
  params: ApprovalEmailParams
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()
  const baseUrl = getBaseUrl()

  const approveUrl = `${baseUrl}/abstimmung/${params.approveToken}?decision=genehmigt`
  const rejectUrl = `${baseUrl}/abstimmung/${params.rejectToken}?decision=abgelehnt`

  const safeApplicantName = escapeHtml(params.applicantName)
  const safeRecipientLabel = escapeHtml(params.recipientLabel)

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: params.recipientEmail,
      subject: `Kostenübernahme-Antrag: ${params.applicantName} – ${formatAmount(params.amount)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Neuer Kostenübernahme-Antrag</h2>

          <p>Hallo ${safeRecipientLabel},</p>

          <p>ein neuer Kostenübernahme-Antrag wurde eingereicht und wartet auf Ihre Entscheidung:</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="border-bottom: 1px solid #e5e5e5;">
              <td style="padding: 8px 0; font-weight: bold; color: #666;">Antragsteller</td>
              <td style="padding: 8px 0;">${safeApplicantName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e5e5;">
              <td style="padding: 8px 0; font-weight: bold; color: #666;">Betrag</td>
              <td style="padding: 8px 0; font-weight: bold; font-size: 18px;">${formatAmount(params.amount)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e5e5;">
              <td style="padding: 8px 0; font-weight: bold; color: #666;">Verwendungszweck</td>
              <td style="padding: 8px 0;">${escapeHtml(params.purpose)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #666;">Eingereicht am</td>
              <td style="padding: 8px 0;">${formatDate(params.createdAt)}</td>
            </tr>
          </table>

          <p style="margin: 24px 0 8px;">Bitte treffen Sie Ihre Entscheidung:</p>

          <div style="margin: 20px 0;">
            <a href="${approveUrl}"
               style="display: inline-block; padding: 12px 32px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 12px;">
              ✓ Genehmigen
            </a>
            <a href="${rejectUrl}"
               style="display: inline-block; padding: 12px 32px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
              ✗ Ablehnen
            </a>
          </div>

          <p style="color: #666; font-size: 13px; margin-top: 32px;">
            Dieser Link ist 14 Tage gültig und kann nur einmal verwendet werden.<br>
            CBS-Mannheim Förderverein – Kostenübernahme-System
          </p>
        </div>
      `,
    })
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler"
    console.error(`E-Mail-Versand fehlgeschlagen an ${params.recipientEmail}:`, message)
    return { success: false, error: message }
  }
}

interface VoteNotificationParams {
  recipientEmail: string
  recipientLabel: string
  voterLabel: string
  decision: string
  applicantName: string
  amount: number
  voteCount: number
}

/**
 * Benachrichtigt andere Genehmiger über eine abgegebene Stimme.
 */
export async function sendVoteNotificationEmail(
  params: VoteNotificationParams
): Promise<void> {
  const resend = getResend()

  const decisionText = params.decision === "genehmigt" ? "genehmigt" : "abgelehnt"
  const safeRecipientLabel = escapeHtml(params.recipientLabel)
  const safeVoterLabel = escapeHtml(params.voterLabel)
  const safeApplicantName = escapeHtml(params.applicantName)

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: params.recipientEmail,
      subject: `Abstimmungs-Update: ${params.voterLabel} hat ${decisionText}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Abstimmungs-Update</h2>

          <p>Hallo ${safeRecipientLabel},</p>

          <p><strong>${safeVoterLabel}</strong> hat den Kostenübernahme-Antrag von
          <strong>${safeApplicantName}</strong> über <strong>${formatAmount(params.amount)}</strong>
          <strong style="color: ${params.decision === "genehmigt" ? "#16a34a" : "#dc2626"};">${decisionText}</strong>.</p>

          <p>Aktueller Stand: ${params.voteCount} von 3 Stimmen abgegeben.</p>

          <p style="color: #666; font-size: 13px; margin-top: 32px;">
            CBS-Mannheim Förderverein – Kostenübernahme-System
          </p>
        </div>
      `,
    })
  } catch (error) {
    console.error(`Benachrichtigungs-E-Mail fehlgeschlagen an ${params.recipientEmail}:`, error)
  }
}

interface FinalDecisionParams {
  recipientEmail: string
  recipientLabel: string
  applicantName: string
  amount: number
  purpose: string
  finalDecision: "genehmigt" | "abgelehnt"
  votes: Array<{ role: string; decision: string }>
}

/**
 * Sendet die Abschluss-E-Mail an Genehmiger mit Zusammenfassung.
 */
export async function sendFinalDecisionToApprover(
  params: FinalDecisionParams
): Promise<void> {
  const resend = getResend()

  const voteSummary = params.votes
    .map((v) => {
      const label = ROLE_LABELS[v.role] || v.role
      const icon = v.decision === "genehmigt" ? "✓" : "✗"
      return `<tr><td style="padding: 4px 12px 4px 0;">${label}</td><td style="color: ${v.decision === "genehmigt" ? "#16a34a" : "#dc2626"};">${icon} ${v.decision}</td></tr>`
    })
    .join("")

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: params.recipientEmail,
      subject: `Entscheidung: Antrag ${params.finalDecision} – ${params.applicantName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Entscheidung gefallen</h2>

          <p>Hallo ${escapeHtml(params.recipientLabel)},</p>

          <p>der Kostenübernahme-Antrag von <strong>${escapeHtml(params.applicantName)}</strong> über
          <strong>${formatAmount(params.amount)}</strong> wurde
          <strong style="color: ${params.finalDecision === "genehmigt" ? "#16a34a" : "#dc2626"};">
          ${params.finalDecision}</strong> (Mehrheitsentscheidung).</p>

          <h3 style="margin-top: 24px;">Abstimmungsübersicht</h3>
          <table style="border-collapse: collapse;">${voteSummary}</table>

          <p style="color: #666; font-size: 13px; margin-top: 32px;">
            CBS-Mannheim Förderverein – Kostenübernahme-System
          </p>
        </div>
      `,
    })
  } catch (error) {
    console.error(`Abschluss-E-Mail fehlgeschlagen an ${params.recipientEmail}:`, error)
  }
}

interface ApplicantNotificationParams {
  applicantEmail: string
  applicantName: string
  amount: number
  purpose: string
  finalDecision: "genehmigt" | "abgelehnt"
  votes: Array<{ role: string; decision: string }>
}

/**
 * Sendet die Ergebnis-E-Mail an den Antragsteller.
 */
export async function sendDecisionToApplicant(
  params: ApplicantNotificationParams
): Promise<void> {
  const resend = getResend()

  const voteSummary = params.votes
    .map((v) => {
      const label = ROLE_LABELS[v.role] || v.role
      const icon = v.decision === "genehmigt" ? "✓" : "✗"
      return `<tr><td style="padding: 4px 12px 4px 0;">${label}</td><td style="color: ${v.decision === "genehmigt" ? "#16a34a" : "#dc2626"};">${icon} ${v.decision}</td></tr>`
    })
    .join("")

  const nextSteps =
    params.finalDecision === "genehmigt"
      ? "Der Verein wird sich in Kürze mit Ihnen bezüglich der Kostenübernahme in Verbindung setzen."
      : "Leider wurde Ihr Antrag abgelehnt. Bei Fragen wenden Sie sich bitte an den Vorstand des CBS-Mannheim Fördervereins."

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: params.applicantEmail,
      subject: `Ihr Kostenübernahme-Antrag wurde ${params.finalDecision}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Entscheidung zu Ihrem Antrag</h2>

          <p>Hallo ${escapeHtml(params.applicantName)},</p>

          <p>Ihr Kostenübernahme-Antrag über <strong>${formatAmount(params.amount)}</strong>
          für „${escapeHtml(params.purpose)}" wurde
          <strong style="color: ${params.finalDecision === "genehmigt" ? "#16a34a" : "#dc2626"}; font-size: 18px;">
          ${params.finalDecision}</strong>.</p>

          <h3 style="margin-top: 24px;">Abstimmungsübersicht</h3>
          <table style="border-collapse: collapse;">${voteSummary}</table>

          <p style="margin-top: 24px;">${nextSteps}</p>

          <p style="color: #666; font-size: 13px; margin-top: 32px;">
            CBS-Mannheim Förderverein – Kostenübernahme-System
          </p>
        </div>
      `,
    })
  } catch (error) {
    console.error(`Ergebnis-E-Mail fehlgeschlagen an ${params.applicantEmail}:`, error)
  }
}

/**
 * Einfaches HTML-Escaping für Benutzereingaben.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
