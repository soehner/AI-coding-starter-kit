import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const BACKUP_CODE_COUNT = 10
const BACKUP_CODE_LENGTH = 8

/**
 * Generiert einen zufälligen alphanumerischen Backup-Code.
 */
function generateBackupCode(): string {
  // Verwende Buchstaben und Zahlen, ohne verwechselbare Zeichen (0/O, 1/l/I)
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = crypto.randomBytes(BACKUP_CODE_LENGTH)
  let code = ""
  for (let i = 0; i < BACKUP_CODE_LENGTH; i++) {
    code += charset[bytes[i] % charset.length]
  }
  // Format: XXXX-XXXX für bessere Lesbarkeit
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

/**
 * POST /api/auth/mfa/backup-codes
 * Generiert 10 Backup-Codes nach erfolgreicher 2FA-Aktivierung.
 * Gibt die Klartext-Codes zurück (werden nur einmal angezeigt).
 */
export async function POST() {
  // Benutzer-Session prüfen
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert." },
      { status: 401 }
    )
  }

  // Prüfen, ob 2FA tatsächlich aktiviert ist
  const { data: mfaData } = await supabase.auth.mfa.listFactors()
  const hasVerifiedFactor = mfaData?.totp?.some(
    (f: { status: string }) => f.status === "verified"
  )

  if (!hasVerifiedFactor) {
    return NextResponse.json(
      { error: "2FA ist nicht aktiviert. Backup-Codes können nur bei aktiver 2FA generiert werden." },
      { status: 400 }
    )
  }

  // Admin-Client verwenden, da RLS keine INSERT-Policy für Benutzer hat
  const adminSupabase = createAdminSupabaseClient()

  // Bestehende Backup-Codes löschen (beim Neu-Generieren)
  await adminSupabase
    .from("mfa_backup_codes")
    .delete()
    .eq("user_id", user.id)

  // Neue Backup-Codes generieren
  const klartextCodes: string[] = []
  const hashPromises: Promise<string>[] = []

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = generateBackupCode()
    klartextCodes.push(code)
    hashPromises.push(bcrypt.hash(code, 12))
  }

  const codeHashes = await Promise.all(hashPromises)

  // Codes in der Datenbank speichern (gehasht)
  const insertData = codeHashes.map((hash) => ({
    user_id: user.id,
    code_hash: hash,
  }))

  const { error: insertError } = await adminSupabase
    .from("mfa_backup_codes")
    .insert(insertData)

  if (insertError) {
    console.error("Fehler beim Speichern der Backup-Codes:", insertError)
    return NextResponse.json(
      { error: "Backup-Codes konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }

  // Klartext-Codes zurückgeben (werden nur einmal angezeigt)
  return NextResponse.json({ codes: klartextCodes })
}
