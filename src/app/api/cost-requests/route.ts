import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/admin-auth"
import { createCostRequestSchema } from "@/lib/validations/cost-request"
import { generateVoteToken } from "@/lib/cost-request-token"
import { sendApprovalRequestEmail } from "@/lib/cost-request-emails"
import { headers } from "next/headers"

const RATE_LIMIT_WINDOW = 3600_000 // 1 Stunde
const RATE_LIMIT_MAX = 3
const requestCounts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = requestCounts.get(ip)

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return false
  }

  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

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
  // Rate-Limiting
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown"

  if (isRateLimited(ip)) {
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
    const profiles = approver.user_profiles as unknown as { email: string }[] | { email: string } | null
    const approverEmail = Array.isArray(profiles) ? profiles[0]?.email : profiles?.email
    if (!approverEmail) {
      allEmailsSent = false
      continue
    }

    // Approve-Token und Reject-Token erzeugen (gleicher Genehmiger, aber getrennte Tokens)
    const { token: approveToken, tokenHash, expiresAt } = generateVoteToken(
      costRequest.id,
      approver.approval_role
    )

    // Token in DB speichern
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

    // E-Mail senden (Token wird sowohl für Genehmigen als auch Ablehnen verwendet)
    const result = await sendApprovalRequestEmail({
      recipientEmail: approverEmail,
      recipientLabel: approver.label,
      applicantName: `${firstName.trim()} ${lastName.trim()}`,
      amount: amountCents,
      purpose: purpose.trim(),
      createdAt: costRequest.created_at,
      approveToken,
      rejectToken: approveToken,
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
