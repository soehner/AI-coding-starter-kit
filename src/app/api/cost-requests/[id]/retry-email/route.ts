import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { generateVoteToken } from "@/lib/cost-request-token"
import { sendApprovalRequestEmail } from "@/lib/cost-request-emails"

/**
 * POST /api/cost-requests/[id]/retry-email
 * Admin-Endpunkt: E-Mail-Versand an Genehmiger wiederholen.
 * Erzeugt neue Tokens und sendet die E-Mails erneut.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { id: requestId } = await params
  const supabase = createAdminSupabaseClient()

  // Antrag laden
  const { data: costRequest, error: requestError } = await supabase
    .from("cost_requests")
    .select("*")
    .eq("id", requestId)
    .single()

  if (requestError || !costRequest) {
    return NextResponse.json(
      { error: "Antrag nicht gefunden." },
      { status: 404 }
    )
  }

  // Nur bei fehlgeschlagenem oder ausstehendem E-Mail-Status wiederholen
  if (costRequest.email_status === "gesendet" && costRequest.status === "offen") {
    return NextResponse.json(
      { error: "E-Mails wurden bereits erfolgreich gesendet." },
      { status: 400 }
    )
  }

  if (costRequest.status !== "offen") {
    return NextResponse.json(
      { error: "Antrag ist bereits entschieden. E-Mail-Versand nicht möglich." },
      { status: 400 }
    )
  }

  // Genehmiger laden
  const { data: approvers, error: approversError } = await supabase
    .from("cost_request_approvers")
    .select("approval_role, label, user_id, user_profiles(email)")

  if (approversError || !approvers || approvers.length < 3) {
    return NextResponse.json(
      { error: "Genehmiger sind nicht vollständig konfiguriert." },
      { status: 503 }
    )
  }

  // Bereits abgegebene Stimmen prüfen
  const { data: existingVotes } = await supabase
    .from("cost_request_votes")
    .select("approval_role")
    .eq("cost_request_id", requestId)

  const votedRoles = new Set((existingVotes || []).map((v) => v.approval_role))

  // Alte Tokens löschen (UNIQUE-Constraint auf (cost_request_id, approval_role)
  // verhindert ein INSERT, wenn nur der Status auf "abgelaufen" gesetzt würde)
  await supabase
    .from("cost_request_tokens")
    .delete()
    .eq("cost_request_id", requestId)

  // Neue Tokens nur für Genehmiger erzeugen, die noch nicht abgestimmt haben
  let allEmailsSent = true
  const applicantName = `${costRequest.applicant_first_name} ${costRequest.applicant_last_name}`

  for (const approver of approvers) {
    if (votedRoles.has(approver.approval_role)) {
      continue // Hat bereits abgestimmt
    }

    const profiles = approver.user_profiles as unknown as { email: string }[] | { email: string } | null
    const approverEmail = Array.isArray(profiles) ? profiles[0]?.email : profiles?.email
    if (!approverEmail) {
      allEmailsSent = false
      continue
    }

    // Zwei separate Tokens: approve und reject. Der intent ist in der
    // HMAC-Signatur verankert und wird beim Voten geprüft.
    const { token: approveToken, tokenHash, expiresAt } = generateVoteToken(
      requestId,
      approver.approval_role,
      "genehmigt"
    )
    const { token: rejectToken } = generateVoteToken(
      requestId,
      approver.approval_role,
      "abgelehnt"
    )

    const { error: tokenError } = await supabase
      .from("cost_request_tokens")
      .insert({
        cost_request_id: requestId,
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
      applicantName,
      amount: costRequest.amount_cents,
      purpose: costRequest.purpose,
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
    .eq("id", requestId)

  return NextResponse.json({
    success: true,
    message: allEmailsSent
      ? "E-Mails wurden erfolgreich erneut gesendet."
      : "Einige E-Mails konnten nicht gesendet werden.",
    allSent: allEmailsSent,
  })
}
