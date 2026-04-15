import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { verifyApprovalToken, hashApprovalToken } from "@/lib/approval-token"
import { antragDecisionSchema } from "@/lib/validations/antrag"
import { evaluateAntragStatus } from "@/lib/antrag-logic"
import { sendAntragDecisionNotificationEmail } from "@/lib/antrag-emails"
import { isRateLimited } from "@/lib/rate-limit"

const DECIDE_RATE_LIMIT_MAX = 20
const DECIDE_RATE_LIMIT_WINDOW_SECONDS = 60

async function rateLimitGuard(prefix: string): Promise<NextResponse | null> {
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown"
  const limited = await isRateLimited(
    `${prefix}:${ip}`,
    DECIDE_RATE_LIMIT_MAX,
    DECIDE_RATE_LIMIT_WINDOW_SECONDS
  )
  if (limited) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    )
  }
  return null
}

/**
 * GET /api/antraege/decide/[token]
 * Validiert das Token eines Antrag-Genehmigers und liefert die Antragsdetails
 * für die öffentliche Entscheidungsseite.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = await rateLimitGuard("antraege-decide-get")
  if (limited) return limited

  const { token } = await params
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 })
  }

  const payload = verifyApprovalToken(token)
  if (!payload || payload.approverRole !== "antrag") {
    return NextResponse.json(
      { error: "Token ungültig oder abgelaufen." },
      { status: 401 }
    )
  }

  const adminClient = createAdminSupabaseClient()
  const tokenHash = hashApprovalToken(token)

  const { data: dbToken } = await adminClient
    .from("antrag_tokens")
    .select("id, status, antrag_id, approver_user_id, expires_at")
    .eq("token_hash", tokenHash)
    .single()

  if (!dbToken) {
    return NextResponse.json(
      { error: "Token nicht gefunden." },
      { status: 401 }
    )
  }

  if (dbToken.status === "verbraucht") {
    const { data: parent } = await adminClient
      .from("antraege")
      .select("status")
      .eq("id", dbToken.antrag_id)
      .single()

    if (parent && parent.status !== "offen") {
      const { data: finalDecisions } = await adminClient
        .from("antrag_entscheidungen")
        .select("decision, comment, approver_user_id")
        .eq("antrag_id", dbToken.antrag_id)

      return NextResponse.json(
        {
          error: "Der Antrag wurde bereits abgeschlossen.",
          alreadyFinalized: true,
          finalStatus: parent.status,
          decisions: (finalDecisions ?? []).map((d) => ({
            decision: d.decision,
            comment: d.comment,
          })),
        },
        { status: 410 }
      )
    }

    return NextResponse.json(
      { error: "Du hast bereits entschieden." },
      { status: 410 }
    )
  }

  if (dbToken.status === "abgelaufen") {
    return NextResponse.json(
      { error: "Token abgelaufen." },
      { status: 401 }
    )
  }

  // Prüfen, dass der Genehmiger noch im Pool ist
  const { data: poolEntry } = await adminClient
    .from("antrag_genehmiger")
    .select("user_id")
    .eq("user_id", dbToken.approver_user_id)
    .maybeSingle()

  if (!poolEntry) {
    await adminClient
      .from("antrag_tokens")
      .update({ status: "abgelaufen" })
      .eq("id", dbToken.id)

    return NextResponse.json(
      {
        error:
          "Dieser Link ist nicht mehr gültig, da du nicht mehr als Antrag-Genehmiger eingetragen bist.",
      },
      { status: 401 }
    )
  }

  // Antragsdetails laden
  const { data: antrag, error: antragError } = await adminClient
    .from("antraege")
    .select(
      `
      id,
      applicant_first_name,
      applicant_last_name,
      applicant_email,
      amount_cents,
      purpose,
      status,
      created_at,
      antrag_dokumente (
        id,
        document_url,
        document_name,
        display_order
      )
    `
    )
    .eq("id", dbToken.antrag_id)
    .single()

  if (antragError || !antrag) {
    return NextResponse.json(
      { error: "Antrag nicht gefunden." },
      { status: 404 }
    )
  }

  const typed = antrag as {
    id: string
    applicant_first_name: string
    applicant_last_name: string
    applicant_email: string
    amount_cents: number
    purpose: string
    status: string
    created_at: string
    antrag_dokumente: Array<{
      id: string
      document_url: string
      document_name: string
      display_order: number
    }>
  }

  if (typed.status !== "offen") {
    const { data: finalDecisions } = await adminClient
      .from("antrag_entscheidungen")
      .select("decision, comment")
      .eq("antrag_id", typed.id)

    return NextResponse.json(
      {
        error: "Der Antrag wurde bereits abgeschlossen.",
        alreadyFinalized: true,
        finalStatus: typed.status,
        decisions: finalDecisions ?? [],
      },
      { status: 410 }
    )
  }

  const documents = [...typed.antrag_dokumente]
    .sort((a, b) => a.display_order - b.display_order)
    .map((d) => ({ id: d.id, url: d.document_url, name: d.document_name }))

  return NextResponse.json({
    antrag_id: typed.id,
    applicant_name: `${typed.applicant_first_name} ${typed.applicant_last_name}`,
    applicant_email: typed.applicant_email,
    amount_cents: typed.amount_cents,
    purpose: typed.purpose,
    created_at: typed.created_at,
    documents,
  })
}

/**
 * POST /api/antraege/decide/[token]
 * Speichert die Entscheidung eines Genehmigers, wertet die Mehrheit aus und
 * benachrichtigt bei Abschluss den Antragsteller.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = await rateLimitGuard("antraege-decide-post")
  if (limited) return limited

  const { token } = await params
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 })
  }

  const payload = verifyApprovalToken(token)
  if (!payload || payload.approverRole !== "antrag") {
    return NextResponse.json(
      { error: "Token ungültig oder abgelaufen." },
      { status: 401 }
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

  const validation = antragDecisionSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Ungültige Eingabe." },
      { status: 400 }
    )
  }

  const { decision, comment } = validation.data
  const adminClient = createAdminSupabaseClient()
  const tokenHash = hashApprovalToken(token)

  const { data: dbToken } = await adminClient
    .from("antrag_tokens")
    .select("id, status, antrag_id, approver_user_id")
    .eq("token_hash", tokenHash)
    .single()

  if (!dbToken) {
    return NextResponse.json(
      { error: "Token nicht gefunden." },
      { status: 401 }
    )
  }

  if (dbToken.status !== "aktiv") {
    const { data: parent } = await adminClient
      .from("antraege")
      .select("status")
      .eq("id", dbToken.antrag_id)
      .single()
    if (parent && parent.status !== "offen") {
      const { data: finalDecisions } = await adminClient
        .from("antrag_entscheidungen")
        .select("decision, comment")
        .eq("antrag_id", dbToken.antrag_id)
      return NextResponse.json(
        {
          error: "Der Antrag wurde bereits abgeschlossen.",
          alreadyFinalized: true,
          finalStatus: parent.status,
          decisions: finalDecisions ?? [],
        },
        { status: 410 }
      )
    }
    return NextResponse.json(
      { error: "Du hast bereits entschieden." },
      { status: 410 }
    )
  }

  // Genehmiger noch im Pool?
  const { data: poolEntry } = await adminClient
    .from("antrag_genehmiger")
    .select("user_id")
    .eq("user_id", dbToken.approver_user_id)
    .maybeSingle()

  if (!poolEntry) {
    await adminClient
      .from("antrag_tokens")
      .update({ status: "abgelaufen" })
      .eq("id", dbToken.id)
    return NextResponse.json(
      {
        error:
          "Dieser Link ist nicht mehr gültig, da du nicht mehr als Antrag-Genehmiger eingetragen bist.",
      },
      { status: 401 }
    )
  }

  // Antrag laden
  const { data: antragRow, error: antragError } = await adminClient
    .from("antraege")
    .select(
      "id, applicant_first_name, applicant_last_name, applicant_email, amount_cents, purpose, status"
    )
    .eq("id", dbToken.antrag_id)
    .single()

  if (antragError || !antragRow) {
    return NextResponse.json(
      { error: "Antrag nicht gefunden." },
      { status: 404 }
    )
  }

  if (antragRow.status !== "offen") {
    return NextResponse.json(
      { error: "Der Antrag wurde bereits abgeschlossen." },
      { status: 410 }
    )
  }

  // Entscheidung einfügen
  const { error: insertError } = await adminClient
    .from("antrag_entscheidungen")
    .insert({
      antrag_id: dbToken.antrag_id,
      approver_user_id: dbToken.approver_user_id,
      decision,
      comment: comment ?? null,
    })

  if (insertError) {
    if (insertError.code === "23505") {
      await adminClient
        .from("antrag_tokens")
        .update({ status: "verbraucht" })
        .eq("id", dbToken.id)
      return NextResponse.json(
        { error: "Du hast bereits entschieden." },
        { status: 410 }
      )
    }
    console.error("Entscheidungs-Insert-Fehler:", insertError)
    return NextResponse.json(
      { error: "Entscheidung konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }

  // Token als verbraucht markieren
  await adminClient
    .from("antrag_tokens")
    .update({ status: "verbraucht" })
    .eq("id", dbToken.id)

  // Mehrheit auswerten
  const totalGenehmiger = (
    await adminClient
      .from("antrag_genehmiger")
      .select("user_id", { count: "exact", head: true })
  ).count ?? 0

  const { data: allDecisions } = await adminClient
    .from("antrag_entscheidungen")
    .select("approver_user_id, decision, comment")
    .eq("antrag_id", dbToken.antrag_id)

  const decisions = (allDecisions ?? []) as Array<{
    approver_user_id: string
    decision: string
    comment: string | null
  }>

  const newStatus = evaluateAntragStatus(totalGenehmiger, decisions)

  if (newStatus !== "offen") {
    await adminClient
      .from("antraege")
      .update({ status: newStatus, decided_at: new Date().toISOString() })
      .eq("id", dbToken.antrag_id)

    // Verbleibende Tokens invalidieren
    await adminClient
      .from("antrag_tokens")
      .update({ status: "verbraucht" })
      .eq("antrag_id", dbToken.antrag_id)
      .eq("status", "aktiv")

    // E-Mails der Entscheider für Benachrichtigung auflösen
    const approverIds = decisions.map((d) => d.approver_user_id)
    const { data: approverProfiles } = await adminClient
      .from("user_profiles")
      .select("id, email")
      .in("id", approverIds)

    const emailMap = new Map<string, string>()
    for (const p of approverProfiles ?? []) emailMap.set(p.id, p.email)

    await sendAntragDecisionNotificationEmail({
      recipientEmail: antragRow.applicant_email,
      applicantName: `${antragRow.applicant_first_name} ${antragRow.applicant_last_name}`,
      amountCents: antragRow.amount_cents,
      purpose: antragRow.purpose,
      finalDecision: newStatus,
      decisions: decisions.map((d) => ({
        approverEmail: emailMap.get(d.approver_user_id) ?? "",
        decision: d.decision,
        comment: d.comment,
      })),
    })
  }

  return NextResponse.json({
    success: true,
    decision,
    finalStatus: newStatus,
  })
}
