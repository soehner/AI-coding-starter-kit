import type { SupabaseClient } from "@supabase/supabase-js"
import { generateApprovalToken } from "@/lib/approval-token"
import { sendApprovalRequestEmail, buildDecisionUrl } from "@/lib/approval-emails"

/**
 * Hilfsfunktionen für die Genehmigungslogik (PROJ-10).
 * Werden sowohl beim Erstellen als auch beim Erneut-Einreichen genutzt.
 */

type ApprovalRoleType = "vorstand" | "zweiter_vorstand"

const ROLE_LABELS: Record<ApprovalRoleType, string> = {
  vorstand: "Vorstand",
  zweiter_vorstand: "2. Vorstand",
}

interface ApproverProfile {
  id: string
  email: string
  roles: ApprovalRoleType[]
}

/**
 * Lädt alle Benutzer mit mindestens einer der gesuchten Zusatzrollen.
 * Gibt pro Benutzer ein Array der Rollen zurück, die er erfüllt.
 */
export async function loadApprovers(
  adminClient: SupabaseClient,
  requiredRoles: ApprovalRoleType[]
): Promise<ApproverProfile[]> {
  const filters: string[] = []
  if (requiredRoles.includes("vorstand")) filters.push("ist_vorstand.eq.true")
  if (requiredRoles.includes("zweiter_vorstand"))
    filters.push("ist_zweiter_vorstand.eq.true")

  if (filters.length === 0) return []

  const { data, error } = await adminClient
    .from("user_profiles")
    .select("id, email, ist_vorstand, ist_zweiter_vorstand")
    .or(filters.join(","))
    .limit(100)

  if (error || !data) return []

  return data.map((u) => {
    const roles: ApprovalRoleType[] = []
    if (requiredRoles.includes("vorstand") && u.ist_vorstand) roles.push("vorstand")
    if (requiredRoles.includes("zweiter_vorstand") && u.ist_zweiter_vorstand)
      roles.push("zweiter_vorstand")
    return { id: u.id, email: u.email, roles }
  })
}

/**
 * Prüft, ob für jede geforderte Rolle mindestens ein Benutzer existiert.
 * Gibt die fehlenden Rollen zurück (leer = alles ok).
 */
export function findMissingRoles(
  approvers: ApproverProfile[],
  requiredRoles: ApprovalRoleType[]
): ApprovalRoleType[] {
  return requiredRoles.filter(
    (role) => !approvers.some((a) => a.roles.includes(role))
  )
}

/**
 * Generiert Tokens, speichert sie in der DB und verschickt E-Mails an alle Genehmiger.
 * Ein Benutzer mit mehreren Rollen erhält eine E-Mail pro Rolle (damit die Entscheidung
 * rollenbezogen erfasst werden kann).
 *
 * Fehlgeschlagene E-Mails werden geloggt, aber der Antrag wird nicht zurückgerollt.
 */
export async function issueTokensAndSendEmails(
  adminClient: SupabaseClient,
  params: {
    requestId: string
    note: string
    documents: Array<{ url: string; name: string }>
    createdAt: string
    requesterEmail: string
    approvers: ApproverProfile[]
  }
): Promise<{ sent: number; failed: number }> {
  const tokenRows: Array<{
    request_id: string
    approver_id: string
    approver_role: ApprovalRoleType
    token_hash: string
    expires_at: string
  }> = []

  const emailJobs: Array<{
    token: string
    approverEmail: string
    approverRole: ApprovalRoleType
  }> = []

  for (const approver of params.approvers) {
    for (const role of approver.roles) {
      const { token, tokenHash, expiresAt } = generateApprovalToken(
        params.requestId,
        approver.id,
        role
      )

      tokenRows.push({
        request_id: params.requestId,
        approver_id: approver.id,
        approver_role: role,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      })

      emailJobs.push({
        token,
        approverEmail: approver.email,
        approverRole: role,
      })
    }
  }

  if (tokenRows.length === 0) {
    return { sent: 0, failed: 0 }
  }

  const { error: insertError } = await adminClient
    .from("approval_tokens")
    .insert(tokenRows)

  if (insertError) {
    throw new Error(`Tokens konnten nicht gespeichert werden: ${insertError.message}`)
  }

  let sent = 0
  let failed = 0

  for (const job of emailJobs) {
    const result = await sendApprovalRequestEmail({
      recipientEmail: job.approverEmail,
      recipientRoleLabel: ROLE_LABELS[job.approverRole],
      requesterEmail: params.requesterEmail,
      note: params.note,
      documents: params.documents,
      createdAt: params.createdAt,
      decisionUrl: buildDecisionUrl(job.token),
    })
    if (result.success) sent++
    else failed++
  }

  return { sent, failed }
}

/**
 * Wertet die Genehmigungslogik (UND/ODER) aus.
 * Gibt den neuen Status zurück oder null, wenn der Antrag noch offen bleibt.
 */
export function evaluateApprovalStatus(
  requiredRoles: ApprovalRoleType[],
  linkType: "und" | "oder",
  decisions: Array<{ approver_role: string; decision: string }>
): "offen" | "genehmigt" | "abgelehnt" {
  // Pro Rolle die jüngste Entscheidung ermitteln (dank UNIQUE(request_id, approver_role)
  // sollte es ohnehin nur eine pro Rolle geben).
  const byRole = new Map<string, string>()
  for (const d of decisions) {
    byRole.set(d.approver_role, d.decision)
  }

  const results = requiredRoles.map((role) => byRole.get(role))

  if (linkType === "und") {
    // Eine Ablehnung → sofort abgelehnt
    if (results.some((r) => r === "abgelehnt")) return "abgelehnt"
    // Alle genehmigt → genehmigt
    if (results.every((r) => r === "genehmigt")) return "genehmigt"
    return "offen"
  }

  // ODER
  // Eine Genehmigung → sofort genehmigt
  if (results.some((r) => r === "genehmigt")) return "genehmigt"
  // Alle abgelehnt → abgelehnt
  if (results.every((r) => r === "abgelehnt")) return "abgelehnt"
  return "offen"
}
