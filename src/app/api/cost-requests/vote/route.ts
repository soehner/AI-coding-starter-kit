import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { verifyVoteToken } from "@/lib/cost-request-token"
import { voteDecisionSchema } from "@/lib/validations/cost-request"
import { isRateLimited } from "@/lib/rate-limit"
import {
  sendVoteNotificationEmail,
  sendFinalDecisionToApprover,
  sendDecisionToApplicant,
} from "@/lib/cost-request-emails"
import { headers } from "next/headers"

const VOTE_RATE_LIMIT_WINDOW_SECONDS = 300 // 5 Minuten
const VOTE_RATE_LIMIT_MAX = 10

const ROLE_LABELS: Record<string, string> = {
  vorsitzender_1: "1. Vorsitzender",
  vorsitzender_2: "2. Vorsitzender",
  kassier: "Kassier",
}

function formatAmount(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100)
}

/**
 * GET /api/cost-requests/vote?token=...
 * Token validieren und Antragsdetails + Abstimmungsstand zurückgeben.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.json(
      { valid: false, errorType: "invalid" },
      { status: 400 }
    )
  }

  // Token kryptographisch prüfen (enthält intent)
  const tokenData = verifyVoteToken(token)
  if (!tokenData) {
    return NextResponse.json(
      { valid: false, errorType: "expired" },
      { status: 200 }
    )
  }

  const supabase = createAdminSupabaseClient()

  // DB-Zeile über (request_id, role) statt Token-Hash suchen,
  // damit sowohl Approve- als auch Reject-Token gültig sind.
  const { data: dbToken, error: tokenError } = await supabase
    .from("cost_request_tokens")
    .select("id, status, cost_request_id, approval_role")
    .eq("cost_request_id", tokenData.requestId)
    .eq("approval_role", tokenData.approvalRole)
    .single()

  if (tokenError || !dbToken) {
    return NextResponse.json(
      { valid: false, errorType: "invalid" },
      { status: 200 }
    )
  }

  if (dbToken.status === "verbraucht") {
    const { data: existingVote } = await supabase
      .from("cost_request_votes")
      .select("decision, voted_at")
      .eq("cost_request_id", dbToken.cost_request_id)
      .eq("approval_role", dbToken.approval_role)
      .single()

    return NextResponse.json({
      valid: false,
      errorType: "used",
      existingVote: existingVote?.decision || null,
    })
  }

  if (dbToken.status === "abgelaufen") {
    return NextResponse.json({
      valid: false,
      errorType: "expired",
    })
  }

  // Antrag laden
  const { data: costRequest, error: requestError } = await supabase
    .from("cost_requests")
    .select("*")
    .eq("id", dbToken.cost_request_id)
    .single()

  if (requestError || !costRequest) {
    return NextResponse.json(
      { valid: false, errorType: "invalid" },
      { status: 200 }
    )
  }

  if (costRequest.status !== "offen") {
    return NextResponse.json({
      valid: false,
      errorType: "decided",
    })
  }

  const { data: votes } = await supabase
    .from("cost_request_votes")
    .select("approval_role, decision, voted_at")
    .eq("cost_request_id", dbToken.cost_request_id)

  const votesList = votes || []
  const approvedCount = votesList.filter((v) => v.decision === "genehmigt").length
  const rejectedCount = votesList.filter((v) => v.decision === "abgelehnt").length

  return NextResponse.json({
    valid: true,
    approverRole: dbToken.approval_role,
    // Vom Token gebundene Absicht — die Abstimmungsseite wählt sie vor.
    intent: tokenData.intent,
    costRequest: {
      id: costRequest.id,
      applicantName: `${costRequest.applicant_first_name} ${costRequest.applicant_last_name}`,
      amount: formatAmount(costRequest.amount_cents),
      purpose: costRequest.purpose,
      createdAt: costRequest.created_at,
      status: costRequest.status,
    },
    voteSummary: {
      total: votesList.length,
      approved: approvedCount,
      rejected: rejectedCount,
    },
  })
}

/**
 * POST /api/cost-requests/vote
 * Stimme abgeben (token-basiert, kein Login).
 */
export async function POST(request: NextRequest) {
  // Rate-Limiting (BUG-5)
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown"

  const limited = await isRateLimited(
    `cost-requests-vote:${ip}`,
    VOTE_RATE_LIMIT_MAX,
    VOTE_RATE_LIMIT_WINDOW_SECONDS
  )

  if (limited) {
    return NextResponse.json(
      { error: "Zu viele Abstimmungsversuche. Bitte versuchen Sie es später erneut." },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage." },
      { status: 400 }
    )
  }

  const parsed = voteDecisionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { token, decision } = parsed.data

  // Token kryptographisch prüfen (enthält intent)
  const tokenData = verifyVoteToken(token)
  if (!tokenData) {
    return NextResponse.json(
      { error: "Dieser Link ist ungültig oder abgelaufen." },
      { status: 400 }
    )
  }

  // BUG-1: Intent aus Token MUSS mit übermittelter Entscheidung übereinstimmen.
  // Verhindert, dass der Approve-Link zum Ablehnen verwendet wird (oder umgekehrt).
  if (tokenData.intent !== decision) {
    return NextResponse.json(
      { error: "Der verwendete Link passt nicht zur gewählten Entscheidung." },
      { status: 400 }
    )
  }

  const supabase = createAdminSupabaseClient()

  // DB-Zeile über (request_id, role) suchen statt über den Token-Hash,
  // damit Approve- und Reject-Token dieselbe Zeile referenzieren.
  const { data: dbToken, error: tokenError } = await supabase
    .from("cost_request_tokens")
    .select("id, status, cost_request_id, approval_role")
    .eq("cost_request_id", tokenData.requestId)
    .eq("approval_role", tokenData.approvalRole)
    .single()

  if (tokenError || !dbToken) {
    return NextResponse.json(
      { error: "Token nicht gefunden." },
      { status: 404 }
    )
  }

  if (dbToken.status !== "aktiv") {
    return NextResponse.json(
      { error: "Sie haben bereits abgestimmt oder der Link ist abgelaufen." },
      { status: 409 }
    )
  }

  // Antrag prüfen
  const { data: costRequest, error: requestError } = await supabase
    .from("cost_requests")
    .select("*")
    .eq("id", dbToken.cost_request_id)
    .single()

  if (requestError || !costRequest || costRequest.status !== "offen") {
    return NextResponse.json(
      { error: "Der Antrag ist nicht mehr offen." },
      { status: 409 }
    )
  }

  // Stimme speichern
  const { error: voteError } = await supabase
    .from("cost_request_votes")
    .insert({
      cost_request_id: dbToken.cost_request_id,
      approval_role: dbToken.approval_role,
      decision,
    })

  if (voteError) {
    console.error("Fehler beim Speichern der Stimme:", voteError)
    return NextResponse.json(
      { error: "Fehler beim Speichern Ihrer Stimme. Bitte versuchen Sie es erneut." },
      { status: 500 }
    )
  }

  // Token als verbraucht markieren
  await supabase
    .from("cost_request_tokens")
    .update({ status: "verbraucht" })
    .eq("id", dbToken.id)

  // Alle bisherigen Stimmen laden (inkl. der gerade abgegebenen)
  const { data: allVotes } = await supabase
    .from("cost_request_votes")
    .select("approval_role, decision, voted_at")
    .eq("cost_request_id", dbToken.cost_request_id)

  const votes = allVotes || []
  const approvedCount = votes.filter((v) => v.decision === "genehmigt").length
  const rejectedCount = votes.filter((v) => v.decision === "abgelehnt").length

  // Genehmiger laden für E-Mail-Benachrichtigungen
  const { data: approvers } = await supabase
    .from("cost_request_approvers")
    .select("approval_role, label, user_id, user_profiles(email)")

  const approverMap = new Map(
    (approvers || []).map((a) => [
      a.approval_role,
      {
        label: a.label,
        email: (() => {
          const profiles = a.user_profiles as unknown as
            | { email: string }[]
            | { email: string }
            | null
          return Array.isArray(profiles) ? profiles[0]?.email || "" : profiles?.email || ""
        })(),
      },
    ])
  )

  const applicantName = `${costRequest.applicant_first_name} ${costRequest.applicant_last_name}`

  // Mehrheit prüfen (2 von 3)
  const majorityReached = approvedCount >= 2 || rejectedCount >= 2
  let finalDecision: "genehmigt" | "abgelehnt" | null = null

  if (majorityReached) {
    finalDecision = approvedCount >= 2 ? "genehmigt" : "abgelehnt"

    await supabase
      .from("cost_requests")
      .update({
        status: finalDecision,
        decided_at: new Date().toISOString(),
      })
      .eq("id", dbToken.cost_request_id)

    await supabase
      .from("cost_request_tokens")
      .update({ status: "verbraucht" })
      .eq("cost_request_id", dbToken.cost_request_id)
      .eq("status", "aktiv")

    for (const [, info] of approverMap) {
      if (info.email) {
        await sendFinalDecisionToApprover({
          recipientEmail: info.email,
          recipientLabel: info.label,
          applicantName,
          amount: costRequest.amount_cents,
          purpose: costRequest.purpose,
          finalDecision,
          votes: votes.map((v) => ({ role: v.approval_role, decision: v.decision })),
        })
      }
    }

    await sendDecisionToApplicant({
      applicantEmail: costRequest.applicant_email,
      applicantName,
      amount: costRequest.amount_cents,
      purpose: costRequest.purpose,
      finalDecision,
      votes: votes.map((v) => ({ role: v.approval_role, decision: v.decision })),
    })
  } else {
    const voterLabel = approverMap.get(dbToken.approval_role)?.label || dbToken.approval_role

    for (const [role, info] of approverMap) {
      if (role !== dbToken.approval_role && info.email) {
        await sendVoteNotificationEmail({
          recipientEmail: info.email,
          recipientLabel: info.label,
          voterLabel,
          decision,
          applicantName,
          amount: costRequest.amount_cents,
          voteCount: votes.length,
        })
      }
    }
  }

  return NextResponse.json({
    success: true,
    decision,
    message: finalDecision
      ? `Ihre Stimme wurde gezählt. Der Antrag wurde ${finalDecision} (Mehrheitsentscheidung).`
      : `Ihre Stimme wurde gezählt. Aktueller Stand: ${votes.length} von 3 Stimmen.`,
    finalDecision: finalDecision || undefined,
    voteCount: votes.length,
  })
}
