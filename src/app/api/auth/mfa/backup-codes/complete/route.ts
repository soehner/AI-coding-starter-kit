import { NextResponse } from "next/server"

/**
 * POST /api/auth/mfa/backup-codes/complete
 * VERALTET: Die Backup-Code-Verifizierung wird jetzt vollständig über
 * /api/auth/mfa/backup-codes/verify abgewickelt (inkl. Cookie-Setzung).
 * Dieser Endpunkt bleibt aus Kompatibilitätsgründen erhalten.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Dieser Endpunkt ist veraltet. Verwenden Sie /api/auth/mfa/backup-codes/verify." },
    { status: 410 }
  )
}
