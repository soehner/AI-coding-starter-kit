import crypto from "crypto"

const TOKEN_EXPIRY_DAYS = 14

export type VoteIntent = "genehmigt" | "abgelehnt"

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
 * Das Token enthält: requestId, approval_role, intent, Ablaufdatum.
 * Die intent-Angabe bindet das Token an eine konkrete Entscheidung und
 * verhindert, dass der Approve-Link zum Ablehnen verwendet werden kann.
 */
export function generateVoteToken(
  requestId: string,
  approvalRole: string,
  intent: VoteIntent
): { token: string; tokenHash: string; expiresAt: Date } {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS)

  const payload = `${requestId}|${approvalRole}|${intent}|${expiresAt.toISOString()}`
  const nonce = crypto.randomBytes(16).toString("hex")
  const tokenData = `${payload}|${nonce}`

  const hmac = crypto.createHmac("sha256", getSecret())
  hmac.update(tokenData)
  const signature = hmac.digest("hex")

  const token = Buffer.from(`${tokenData}|${signature}`).toString("base64url")
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

  return { token, tokenHash, expiresAt }
}

/**
 * Validiert ein Token und gibt die enthaltenen Daten zurück.
 * Gibt null zurück, wenn das Token ungültig oder manipuliert ist.
 */
export function verifyVoteToken(
  token: string
): {
  requestId: string
  approvalRole: string
  intent: VoteIntent
  expiresAt: Date
} | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8")
    const parts = decoded.split("|")

    if (parts.length !== 6) return null

    const [requestId, approvalRole, intent, expiresIso, nonce, signature] = parts

    if (intent !== "genehmigt" && intent !== "abgelehnt") return null

    const payload = `${requestId}|${approvalRole}|${intent}|${expiresIso}|${nonce}`

    const hmac = crypto.createHmac("sha256", getSecret())
    hmac.update(payload)
    const expectedSignature = hmac.digest("hex")

    const sigBuffer = Buffer.from(signature, "hex")
    const expectedBuffer = Buffer.from(expectedSignature, "hex")

    if (sigBuffer.length !== expectedBuffer.length) return null
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null
    }

    const expiresAt = new Date(expiresIso)
    if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
      return null
    }

    return { requestId, approvalRole, intent: intent as VoteIntent, expiresAt }
  } catch {
    return null
  }
}

/**
 * Berechnet den Hash eines Tokens (für Audit-Zwecke).
 * Die DB-Zeile wird über (cost_request_id, approval_role) identifiziert,
 * nicht mehr über den Token-Hash. Der gespeicherte Hash dient nur als
 * Nachweis welches Token zuletzt erzeugt wurde.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}
