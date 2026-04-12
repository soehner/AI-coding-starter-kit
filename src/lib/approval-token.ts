import crypto from "crypto"

/**
 * HMAC-signierte Tokens für PROJ-10 Genehmigungslinks.
 * Jeder Genehmiger erhält einen eigenen Token, der:
 *   - request_id + approver_id + approver_role bindet
 *   - nach 7 Tagen abläuft
 *   - nur einmal verwendbar ist (Status in DB: aktiv → verbraucht)
 */

const TOKEN_EXPIRY_DAYS = 7

function getSecret(): string {
  const secret = process.env.APPROVAL_TOKEN_SECRET
  if (!secret) {
    throw new Error(
      "APPROVAL_TOKEN_SECRET ist nicht gesetzt. Bitte in .env.local konfigurieren."
    )
  }
  return secret
}

export interface ApprovalTokenPayload {
  requestId: string
  approverId: string
  approverRole: string
  expiresAt: Date
}

/**
 * Erzeugt ein HMAC-signiertes Token für einen Genehmiger.
 */
export function generateApprovalToken(
  requestId: string,
  approverId: string,
  approverRole: string
): { token: string; tokenHash: string; expiresAt: Date } {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS)

  const nonce = crypto.randomBytes(16).toString("hex")
  const payload = `${requestId}|${approverId}|${approverRole}|${expiresAt.toISOString()}|${nonce}`

  const hmac = crypto.createHmac("sha256", getSecret())
  hmac.update(payload)
  const signature = hmac.digest("hex")

  const token = Buffer.from(`${payload}|${signature}`).toString("base64url")
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

  return { token, tokenHash, expiresAt }
}

/**
 * Verifiziert ein Token und gibt den Payload zurück.
 * Gibt null zurück bei:
 *   - manipulierter Signatur
 *   - abgelaufenem Token
 *   - Parse-Fehlern
 */
export function verifyApprovalToken(token: string): ApprovalTokenPayload | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8")
    const parts = decoded.split("|")

    if (parts.length !== 6) return null

    const [requestId, approverId, approverRole, expiresIso, nonce, signature] = parts
    const payload = `${requestId}|${approverId}|${approverRole}|${expiresIso}|${nonce}`

    const hmac = crypto.createHmac("sha256", getSecret())
    hmac.update(payload)
    const expectedSignature = hmac.digest("hex")

    const sigBuf = Buffer.from(signature, "hex")
    const expBuf = Buffer.from(expectedSignature, "hex")

    if (sigBuf.length !== expBuf.length) return null
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null

    const expiresAt = new Date(expiresIso)
    if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
      return null
    }

    return { requestId, approverId, approverRole, expiresAt }
  } catch {
    return null
  }
}

/**
 * Berechnet den Hash eines Tokens für den DB-Lookup.
 */
export function hashApprovalToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}
