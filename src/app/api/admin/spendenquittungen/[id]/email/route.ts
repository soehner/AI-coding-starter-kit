import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { spendenquittungEmailSchema } from "@/lib/validations/spendenquittung"
import { sendeSpendenquittungEmail } from "@/lib/spendenquittung-email"
import { rendereAktuelleSpendenquittungPdf } from "@/lib/spendenquittung-render"
import { isRateLimited } from "@/lib/rate-limit"

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Rate-Limit: 30 E-Mail-Versendungen pro Stunde pro Admin
const EMAIL_RATE_LIMIT_MAX = 30
const EMAIL_RATE_LIMIT_WINDOW = 3600

/**
 * POST /api/admin/spendenquittungen/[id]/email
 * Sendet die Quittung als PDF-Anhang per E-Mail.
 *
 * Body:
 *   empfaenger  – E-Mail-Adresse
 *   betreff     – Betreff (editierbar im Dialog)
 *   text        – Nachrichtentext (editierbar)
 *
 * Wird sowohl beim ersten Versand als auch beim "Erneut senden" verwendet.
 * Bei Erfolg werden `email_versendet_am` und `email_empfaenger` aktualisiert.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { id } = await params
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { error: "Ungültige Quittungs-ID." },
      { status: 400 }
    )
  }

  // Rate-Limiting pro Admin
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown"
  const limited = await isRateLimited(
    `spendenquittung-email:${auth.profile.id}:${ip}`,
    EMAIL_RATE_LIMIT_MAX,
    EMAIL_RATE_LIMIT_WINDOW
  )
  if (limited) {
    return NextResponse.json(
      {
        error:
          "Zu viele E-Mail-Versendungen in kurzer Zeit. Bitte später erneut versuchen.",
      },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 }
    )
  }

  const validation = spendenquittungEmailSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      {
        error: validation.error.issues[0]?.message ?? "Ungültige Eingabe.",
      },
      { status: 400 }
    )
  }

  const { empfaenger, betreff, text, cc } = validation.data
  const supabase = createAdminSupabaseClient()

  // PDF frisch aus den aktuellen Spenderdaten rendern – so enthält der
  // Anhang immer die neuesten Daten, auch wenn der Spender nach dem
  // Erstellen der Quittung korrigiert wurde.
  const pdfResult = await rendereAktuelleSpendenquittungPdf(supabase, id)

  if (!pdfResult.ok) {
    return NextResponse.json(
      { error: pdfResult.error },
      { status: pdfResult.status }
    )
  }

  const result = await sendeSpendenquittungEmail({
    empfaenger,
    betreff,
    text,
    pdfBuffer: pdfResult.pdfBuffer,
    pdfDateiname: `${pdfResult.quittungNummer}.pdf`,
    cc,
  })

  if (!result.success) {
    return NextResponse.json(
      {
        error: `E-Mail-Versand fehlgeschlagen: ${result.error ?? "Unbekannter Fehler"}.`,
      },
      { status: 502 }
    )
  }

  // Versand erfolgreich – DB aktualisieren
  const { error: updateError } = await supabase
    .from("spendenquittungen")
    .update({
      email_versendet_am: new Date().toISOString(),
      email_empfaenger: empfaenger,
    })
    .eq("id", id)

  if (updateError) {
    console.error(
      "Versandstatus konnte nicht gespeichert werden:",
      updateError.message
    )
    // E-Mail wurde aber bereits versendet – wir geben Erfolg zurück
    // mit einer Warnung.
    return NextResponse.json({
      success: true,
      warning:
        "E-Mail wurde versendet, aber der Versandstatus konnte nicht in der Datenbank gespeichert werden.",
    })
  }

  return NextResponse.json({ success: true })
}
