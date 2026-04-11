import crypto from "crypto"

const TOKEN_EXPIRY_DAYS = 14

function getSecret(): string {
  const secret = process.env.APPROVAL_TOKEN_SECRET
  if (!secret) {
    throw new Error(
      "APPROVAL_TOKEN_SECRET ist nicht gesetzt. Bitte in .env.local konfigurieren."
    )
  }
  return secret
}

/**
 * Erzeugt ein HMAC-signiertes Token für eine Genehmiger-Abstimmung.
 * Das Token enthält: requestId, approval_role, Ablaufdatum.
 */
export function generateVoteToken(
  requestId: string,
  approvalRole: string
): { token: string; tokenHash: string; expiresAt: Date } {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS)

  const payload = `${requestId}:${approvalRole}:${expiresAt.toISOString()}`
  const nonce = crypto.randomBytes(16).toString("hex")
  const tokenData = `${payload}:${nonce}`

  const hmac = crypto.createHmac("sha256", getSecret())
  hmac.update(tokenData)
  const signature = hmac.digest("hex")

  const token = Buffer.from(`${tokenData}:${signature}`).toString("base64url")
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

  return { token, tokenHash, expiresAt }
}

/**
 * Validiert ein Token und gibt die enthaltenen Daten zurück.
 * Gibt null zurück, wenn das Token ungültig oder manipuliert ist.
 */
export function verifyVoteToken(
  token: string
): { requestId: string; approvalRole: string; expiresAt: Date } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8")
    const parts = decoded.split(":")

    if (parts.length !== 5) return null

    const [requestId, approvalRole, expiresIso, nonce, signature] = parts
    const payload = `${requestId}:${approvalRole}:${expiresIso}:${nonce}`

    const hmac = crypto.createHmac("sha256", getSecret())
    hmac.update(payload)
    const expectedSignature = hmac.digest("hex")

    if (!crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    )) {
      return null
    }

    const expiresAt = new Date(expiresIso)
    if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
      return null
    }

    return { requestId, approvalRole, expiresAt }
  } catch {
    return null
  }
}

/**
 * Berechnet den Hash eines Tokens (für DB-Lookup).
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}
