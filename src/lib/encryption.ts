import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY Umgebungsvariable fehlt. Bitte in .env.local setzen."
    )
  }

  // Key muss 32 Bytes (256 Bit) sein - als Hex-String = 64 Zeichen
  const keyBuffer = Buffer.from(key, "hex")
  if (keyBuffer.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY muss ein 64-Zeichen Hex-String sein (256 Bit)."
    )
  }

  return keyBuffer
}

/**
 * Verschlüsselt einen Klartext-String mit AES-256-GCM.
 * Gibt einen Base64-String zurück: IV + AuthTag + Ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  // Format: IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted])
  return combined.toString("base64")
}

/**
 * Entschlüsselt einen Base64-String zurück in Klartext.
 */
export function decrypt(encryptedBase64: string): string {
  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedBase64, "base64")

  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}
