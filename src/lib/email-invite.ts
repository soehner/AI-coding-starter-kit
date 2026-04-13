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

export function getSiteUrl(): string {
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

const BRAND_COLOR = "#1d3d5d"

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  viewer: "Betrachter",
}

export async function sendInvitationEmail(
  email: string,
  confirmUrl: string,
  role: string
): Promise<void> {
  const resend = getResend()
  const roleLabel = ROLE_LABELS[role] ?? role
  const safeConfirmUrl = escapeHtml(confirmUrl)

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Einladung – CBS-Finanz</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:560px;max-width:560px;">
          <tr>
            <td>
              <div style="background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="background-color:${BRAND_COLOR};padding:24px 32px;">
                      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
                        Willkommen beim CBS-Finanz-Portal
                      </h1>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="padding:28px 32px 32px 32px;">
                      <p style="margin:0 0 16px 0;color:#374151;font-size:15px;line-height:24px;">
                        Sie wurden vom Kassenwart des <strong>CBS-Mannheim Fördervereins</strong> eingeladen, das interne Finanzportal zu nutzen.
                      </p>
                      <p style="margin:0 0 24px 0;color:#374151;font-size:15px;line-height:24px;">
                        Ihre Rolle: <strong>${escapeHtml(roleLabel)}</strong>
                      </p>
                      <p style="margin:0 0 24px 0;color:#374151;font-size:15px;line-height:24px;">
                        Klicken Sie auf den folgenden Button, um Ihr Konto einzurichten und ein Passwort festzulegen:
                      </p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td align="center" style="padding:4px 0 24px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td align="center" style="background-color:${BRAND_COLOR};border-radius:8px;">
                                  <a href="${safeConfirmUrl}" target="_blank"
                                     style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
                                    Einladung annehmen
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0;color:#9ca3af;font-size:12px;line-height:18px;">
                        Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:
                      </p>
                      <p style="margin:4px 0 0 0;font-size:12px;line-height:18px;word-break:break-all;">
                        <a href="${safeConfirmUrl}" style="color:#6b7280;">${safeConfirmUrl}</a>
                      </p>
                      <p style="margin:24px 0 0 0;color:#9ca3af;font-size:12px;line-height:18px;">
                        Diese Einladung ist 24 Stunden gültig. Falls Sie diese E-Mail irrtümlich erhalten haben, ignorieren Sie sie bitte.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 0 0 0;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:18px;">
                CBS-Mannheim Förderverein &mdash; Digitale Kassenbuchführung
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const { error } = await resend.emails.send({
    from: getFromEmail(),
    to: email,
    subject: "Einladung zum CBS-Finanz-Portal",
    html,
  })

  if (error) {
    throw new Error(
      `Einladungs-E-Mail konnte nicht gesendet werden: ${error.message}`
    )
  }
}
