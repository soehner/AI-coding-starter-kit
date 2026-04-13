import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { verifyApprovalToken, hashApprovalToken } from "@/lib/approval-token"
import { approvalDecisionSchema } from "@/lib/validations/approval"
import { evaluateApprovalStatus } from "@/lib/approval-logic"
import { sendDecisionNotificationEmail } from "@/lib/approval-emails"
import { isRateLimited } from "@/lib/rate-limit"

type ApprovalRoleType = "vorstand" | "zweiter_vorstand"

// BUG-9: Rate-Limits für öffentliche Token-Endpunkte
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
 * GET /api/approvals/decide/[token]
 * Token validieren und Antragsdetails zurückgeben (für die öffentliche Entscheidungsseite).
 *
 * Statuscodes:
 *   200 – Token gültig, Antragsdetails im Body
 *   401 – Token ungültig oder abgelaufen
 *   410 – Token bereits verwendet (existingDecision im Body)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // BUG-9: Rate-Limiting (20/min pro IP)
  const limited = await rateLimitGuard("approvals-decide-get")
  if (limited) return limited

  const { token } = await params
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 })
  }

  // Kryptografische Prüfung
  const payload = verifyApprovalToken(token)
  if (!payload) {
    return NextResponse.json(
      { error: "Token ungültig oder abgelaufen." },
      { status: 401 }
    )
  }

  const adminClient = createAdminSupabaseClient()
  const tokenHash = hashApprovalToken(token)

  // Token-Datensatz laden
  const { data: dbToken } = await adminClient
    .from("approval_tokens")
    .select("id, status, request_id, approver_id, approver_role, expires_at")
    .eq("token_hash", tokenHash)
    .single()

  if (!dbToken) {
    return NextResponse.json(
      { error: "Token nicht gefunden." },
      { status: 401 }
    )
  }

  if (dbToken.status === "verbraucht") {
    // Bisherige Entscheidung mitschicken + BUG-4 Unterscheidung
    const { data: existing } = await adminClient
      .from("approval_decisions")
      .select("decision, approver_id")
      .eq("request_id", dbToken.request_id)
      .eq("approver_role", dbToken.approver_role)
      .single()

    const selfDecided = existing?.approver_id === dbToken.approver_id
    const roleLabel =
      dbToken.approver_role === "vorstand" ? "Vorstand" : "2. Vorstand"

    return NextResponse.json(
      {
        error: selfDecided
          ? "Du hast bereits entschieden."
          : `Ein anderes Mitglied der Rolle „${roleLabel}" hat bereits entschieden.`,
        decision: existing?.decision ?? null,
      },
      { status: 410 }
    )
  }

  if (dbToken.status === "abgelaufen") {
    return NextResponse.json(
      { error: "Token abgelaufen." },
      { status: 401 }
    )
  }

  // BUG-5: Prüfen, ob der Benutzer die gebundene Rolle NOCH hat
  const { data: approverProfile } = await adminClient
    .from("user_profiles")
    .select("ist_vorstand, ist_zweiter_vorstand")
    .eq("id", dbToken.approver_id)
    .single()

  const stillHasRole =
    (dbToken.approver_role === "vorstand" && approverProfile?.ist_vorstand === true) ||
    (dbToken.approver_role === "zweiter_vorstand" &&
      approverProfile?.ist_zweiter_vorstand === true)

  if (!stillHasRole) {
    // Token sofort invalidieren
    await adminClient
      .from("approval_tokens")
      .update({ status: "abgelaufen" })
      .eq("id", dbToken.id)

    return NextResponse.json(
      {
        error:
          "Dieser Link ist nicht mehr gültig, da dir die Genehmiger-Rolle entzogen wurde.",
      },
      { status: 401 }
    )
  }

  // Antragsdetails laden
  const { data: requestRow, error: requestError } = await adminClient
    .from("approval_requests")
    .select(
      `
      id,
      note,
      document_url,
      document_name,
      status,
      link_type,
      created_at,
      creator:user_profiles!approval_requests_created_by_fkey ( email ),
      approval_documents (
        id,
        document_url,
        document_name,
        display_order
      )
      `
    )
    .eq("id", dbToken.request_id)
    .single()

  if (requestError || !requestRow) {
    return NextResponse.json(
      { error: "Antrag nicht gefunden." },
      { status: 404 }
    )
  }

  if (requestRow.status !== "offen") {
    // Finalisierte Entscheidungen inkl. Rolle ermitteln
    const { data: finalDecisions } = await adminClient
      .from("approval_decisions")
      .select("decision, approver_role, comment")
      .eq("request_id", dbToken.request_id)

    return NextResponse.json(
      {
        error: "Der Antrag wurde bereits abgeschlossen.",
        alreadyFinalized: true,
        finalStatus: requestRow.status,
        linkType: requestRow.link_type,
        decisions: (finalDecisions || []).map((d) => ({
          role: d.approver_role,
          decision: d.decision,
          comment: d.comment,
        })),
      },
      { status: 410 }
    )
  }

  const typedRow = requestRow as unknown as {
    id: string
    note: string
    document_url: string | null
    document_name: string | null
    created_at: string
    creator: { email: string } | { email: string }[] | null
    approval_documents: Array<{
      id: string
      document_url: string
      document_name: string
      display_order: number
    }>
  }
  const creator = typedRow.creator
  const creatorEmail = Array.isArray(creator) ? creator[0]?.email : creator?.email

  const documents = (typedRow.approval_documents || [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((d) => ({ id: d.id, url: d.document_url, name: d.document_name }))

  return NextResponse.json({
    request_id: typedRow.id,
    note: typedRow.note,
    document_url: typedRow.document_url,
    document_name: typedRow.document_name,
    documents,
    created_at: typedRow.created_at,
    created_by_email: creatorEmail ?? "",
  })
}

/**
 * POST /api/approvals/decide/[token]
 * Speichert die Entscheidung eines Genehmigers.
 * - Token wird als "verbraucht" markiert
 * - UND/ODER-Logik wird ausgewertet
 * - Antragsteller wird ggf. per E-Mail benachrichtigt
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // BUG-9: Rate-Limiting (20/min pro IP)
  const limited = await rateLimitGuard("approvals-decide-post")
  if (limited) return limited

  const { token } = await params
  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 })
  }

  const payload = verifyApprovalToken(token)
  if (!payload) {
    return NextResponse.json(
      { error: "Token ungültig oder abgelaufen." },
      { status: 401 }
    )
  }

  // Body validieren
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage." },
      { status: 400 }
    )
  }

  const validation = approvalDecisionSchema.safeParse(body)
  if (!validation.success) {
    const firstError =
      validation.error.issues[0]?.message ?? "Ungültige Eingabe."
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { decision, comment } = validation.data
  const adminClient = createAdminSupabaseClient()
  const tokenHash = hashApprovalToken(token)

  // Token laden
  const { data: dbToken } = await adminClient
    .from("approval_tokens")
    .select("id, status, request_id, approver_id, approver_role")
    .eq("token_hash", tokenHash)
    .single()

  if (!dbToken) {
    return NextResponse.json(
      { error: "Token nicht gefunden." },
      { status: 401 }
    )
  }

  if (dbToken.status !== "aktiv") {
    const { data: existing } = await adminClient
      .from("approval_decisions")
      .select("decision, approver_id")
      .eq("request_id", dbToken.request_id)
      .eq("approver_role", dbToken.approver_role)
      .single()

    // BUG-4: Unterscheidung — habe ICH entschieden oder ein Kollege mit gleicher Rolle?
    const selfDecided = existing?.approver_id === dbToken.approver_id
    const roleLabel =
      dbToken.approver_role === "vorstand" ? "Vorstand" : "2. Vorstand"

    return NextResponse.json(
      {
        error: selfDecided
          ? "Du hast bereits entschieden."
          : `Ein anderes Mitglied der Rolle „${roleLabel}" hat bereits entschieden.`,
        decision: existing?.decision ?? null,
      },
      { status: 410 }
    )
  }

  // BUG-5: Auch beim POST Rolle noch prüfen
  const { data: approverProfilePost } = await adminClient
    .from("user_profiles")
    .select("ist_vorstand, ist_zweiter_vorstand")
    .eq("id", dbToken.approver_id)
    .single()

  const stillHasRolePost =
    (dbToken.approver_role === "vorstand" &&
      approverProfilePost?.ist_vorstand === true) ||
    (dbToken.approver_role === "zweiter_vorstand" &&
      approverProfilePost?.ist_zweiter_vorstand === true)

  if (!stillHasRolePost) {
    await adminClient
      .from("approval_tokens")
      .update({ status: "abgelaufen" })
      .eq("id", dbToken.id)

    return NextResponse.json(
      {
        error:
          "Dieser Link ist nicht mehr gültig, da dir die Genehmiger-Rolle entzogen wurde.",
      },
      { status: 401 }
    )
  }

  // Antrag prüfen — muss "offen" sein
  const { data: requestRow, error: requestError } = await adminClient
    .from("approval_requests")
    .select("id, note, status, link_type, required_roles, created_by")
    .eq("id", dbToken.request_id)
    .single()

  if (requestError || !requestRow) {
    return NextResponse.json(
      { error: "Antrag nicht gefunden." },
      { status: 404 }
    )
  }

  if (requestRow.status !== "offen") {
    const { data: finalDecisions } = await adminClient
      .from("approval_decisions")
      .select("decision, approver_role, comment")
      .eq("request_id", dbToken.request_id)

    return NextResponse.json(
      {
        error: "Der Antrag wurde bereits abgeschlossen.",
        alreadyFinalized: true,
        finalStatus: requestRow.status,
        linkType: requestRow.link_type,
        decisions: (finalDecisions || []).map((d) => ({
          role: d.approver_role,
          decision: d.decision,
          comment: d.comment,
        })),
      },
      { status: 410 }
    )
  }

  // Entscheidung einfügen (UPSERT über UNIQUE-Constraint request_id + approver_role)
  const { error: insertError } = await adminClient
    .from("approval_decisions")
    .insert({
      request_id: dbToken.request_id,
      approver_id: dbToken.approver_id,
      approver_role: dbToken.approver_role,
      decision,
      comment: comment ?? null,
    })

  if (insertError) {
    // BUG-4: Unique-Konflikt = ein Kollege mit gleicher Rolle war schneller
    if (insertError.code === "23505") {
      await adminClient
        .from("approval_tokens")
        .update({ status: "verbraucht" })
        .eq("id", dbToken.id)

      const roleLabel =
        dbToken.approver_role === "vorstand" ? "Vorstand" : "2. Vorstand"

      return NextResponse.json(
        {
          error: `Ein anderes Mitglied der Rolle „${roleLabel}" hat inzwischen entschieden.`,
          decision: null,
        },
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
    .from("approval_tokens")
    .update({ status: "verbraucht" })
    .eq("id", dbToken.id)

  // Falls bei UND/ODER eine andere Rolle bereits entschieden hat: verbleibende Tokens
  // der *gleichen Rolle* ebenfalls invalidieren (mehrere Personen pro Rolle).
  await adminClient
    .from("approval_tokens")
    .update({ status: "verbraucht" })
    .eq("request_id", dbToken.request_id)
    .eq("approver_role", dbToken.approver_role)
    .eq("status", "aktiv")

  // Gesamtstatus neu auswerten
  const { data: allDecisions } = await adminClient
    .from("approval_decisions")
    .select("approver_role, decision, comment")
    .eq("request_id", dbToken.request_id)

  const decisions = (allDecisions || []) as Array<{
    approver_role: string
    decision: string
    comment: string | null
  }>

  const newStatus = evaluateApprovalStatus(
    requestRow.required_roles as ApprovalRoleType[],
    requestRow.link_type as "und" | "oder",
    decisions
  )

  if (newStatus !== "offen") {
    // Status aktualisieren
    await adminClient
      .from("approval_requests")
      .update({ status: newStatus })
      .eq("id", dbToken.request_id)

    // Alle verbleibenden Tokens invalidieren
    await adminClient
      .from("approval_tokens")
      .update({ status: "verbraucht" })
      .eq("request_id", dbToken.request_id)
      .eq("status", "aktiv")

    // Benachrichtigungs-E-Mail an den Antragsteller
    const { data: creator } = await adminClient
      .from("user_profiles")
      .select("email")
      .eq("id", requestRow.created_by)
      .single()

    if (creator?.email) {
      await sendDecisionNotificationEmail({
        recipientEmail: creator.email,
        finalDecision: newStatus,
        note: requestRow.note,
        decisions: decisions.map((d) => ({
          role: d.approver_role,
          decision: d.decision,
          comment: d.comment,
        })),
      })
    }
  }

  return NextResponse.json({
    success: true,
    decision,
    finalStatus: newStatus,
  })
}
