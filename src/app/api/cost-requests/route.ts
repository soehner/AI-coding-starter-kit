import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/admin-auth"
import { createCostRequestSchema } from "@/lib/validations/cost-request"
import { generateVoteToken } from "@/lib/cost-request-token"
import { sendApprovalRequestEmail } from "@/lib/cost-request-emails"
import { isRateLimited } from "@/lib/rate-limit"
import { headers } from "next/headers"

const RATE_LIMIT_WINDOW_SECONDS = 3600 // 1 Stunde
const RATE_LIMIT_MAX = 3

/**
 * GET /api/cost-requests
 * Admin-Endpunkt: Alle Kostenübernahme-Anträge mit Stimmen laden.
 */
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from("cost_requests")
    .select(
      `
      *,
      cost_request_votes (
        approval_role,
        decision,
        voted_at
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    console.error("Fehler beim Laden der Anträge:", error)
    return NextResponse.json(
      { error: "Anträge konnten nicht geladen werden." },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}

/**
 * POST /api/cost-requests
 * Öffentliche Route: Kostenübernahme-Antrag einreichen.
 */
export async function POST(request: NextRequest) {
  // Rate-Limiting (DB-basiert, serverless-sicher)
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown"

  const limited = await isRateLimited(
    `cost-requests-submit:${ip}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_SECONDS
  )

  if (limited) {
    return NextResponse.json(
      { error: "Zu viele Anträge. Bitte versuchen Sie es später erneut." },
      { status: 429 }
    )
  }

  // Eingabe validieren
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage." },
      { status: 400 }
    )
  }

  const parsed = createCostRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { firstName, lastName, email, amount, purpose } = parsed.data
  const amountCents = Math.round(amount * 100)

  const supabase = createAdminSupabaseClient()

  // Prüfen ob alle 3 Genehmiger konfiguriert sind
  const { data: approvers, error: approversError } = await supabase
    .from("cost_request_approvers")
    .select("approval_role, label, user_id, user_profiles(email)")

  if (approversError || !approvers || approvers.length < 3) {
    return NextResponse.json(
      {
        error:
          "Das Genehmigungssystem ist noch nicht vollständig eingerichtet. Bitte kontaktieren Sie den Kassier des Vereins.",
      },
      { status: 503 }
    )
  }

  // Antrag in Datenbank speichern
  const { data: costRequest, error: insertError } = await supabase
    .from("cost_requests")
    .insert({
      applicant_first_name: firstName.trim(),
      applicant_last_name: lastName.trim(),
      applicant_email: email.trim().toLowerCase(),
      amount_cents: amountCents,
      purpose: purpose.trim(),
      status: "offen",
      email_status: "ausstehend",
    })
    .select("id, created_at")
    .single()

  if (insertError || !costRequest) {
    console.error("Fehler beim Speichern des Antrags:", insertError)
    return NextResponse.json(
      { error: "Fehler beim Speichern des Antrags. Bitte versuchen Sie es erneut." },
      { status: 500 }
    )
  }

  // Tokens für alle 3 Genehmiger erzeugen und E-Mails senden
  let allEmailsSent = true

  for (const approver of approvers) {
    const profiles = approver.user_profiles as unknown as
      | { email: string }[]
      | { email: string }
      | null
    const approverEmail = Array.isArray(profiles)
      ? profiles[0]?.email
      : profiles?.email
    if (!approverEmail) {
      allEmailsSent = false
      continue
    }

    // Zwei separate Tokens: einer für Genehmigen, einer für Ablehnen.
    // Das intent ist in der HMAC-Signatur verankert und wird beim Voten geprüft.
    const { token: approveToken, tokenHash, expiresAt } = generateVoteToken(
      costRequest.id,
      approver.approval_role,
      "genehmigt"
    )
    const { token: rejectToken } = generateVoteToken(
      costRequest.id,
      approver.approval_role,
      "abgelehnt"
    )

    // EIN DB-Eintrag pro (request, role) als Statusmarker. Der gespeicherte
    // Hash gehört zum Approve-Token (Audit-Zweck). Beide Tokens sind
    // kryptographisch gültig, der DB-Lookup beim Voten erfolgt über
    // (cost_request_id, approval_role).
    const { error: tokenError } = await supabase
      .from("cost_request_tokens")
      .insert({
        cost_request_id: costRequest.id,
        approval_role: approver.approval_role,
        token_hash: tokenHash,
        status: "aktiv",
        expires_at: expiresAt.toISOString(),
      })

    if (tokenError) {
      console.error(`Token-Erstellung fehlgeschlagen für ${approver.approval_role}:`, tokenError)
      allEmailsSent = false
      continue
    }

    const result = await sendApprovalRequestEmail({
      recipientEmail: approverEmail,
      recipientLabel: approver.label,
      applicantName: `${firstName.trim()} ${lastName.trim()}`,
      amount: amountCents,
      purpose: purpose.trim(),
      createdAt: costRequest.created_at,
      approveToken,
      rejectToken,
    })

    if (!result.success) {
      allEmailsSent = false
    }
  }

  // E-Mail-Status aktualisieren
  await supabase
    .from("cost_requests")
    .update({ email_status: allEmailsSent ? "gesendet" : "fehlgeschlagen" })
    .eq("id", costRequest.id)

  return NextResponse.json(
    {
      success: true,
      message: "Ihr Antrag wurde erfolgreich eingereicht. Die Genehmiger wurden per E-Mail benachrichtigt.",
      id: costRequest.id,
    },
    { status: 201 }
  )
}
