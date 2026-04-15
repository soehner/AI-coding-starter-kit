import type { SupabaseClient } from "@supabase/supabase-js"
import { generateApprovalToken } from "@/lib/approval-token"
import {
  sendAntragApprovalRequestEmail,
  buildAntragDecisionUrl,
} from "@/lib/antrag-emails"

/**
 * PROJ-11: Logik für Kostenübernahme-Anträge.
 * Unabhängig vom PROJ-10-Genehmigungssystem — eigener Genehmiger-Pool,
 * eigene Tokens, eigene Mehrheits-Auswertung.
 */

export interface AntragGenehmiger {
  id: string
  email: string
}

export interface AntragDetails {
  id: string
  applicantName: string
  applicantEmail: string
  amountCents: number
  purpose: string
  createdAt: string
  documents: Array<{ url: string; name: string }>
}

/**
 * Lädt alle Benutzer, die als Antrag-Genehmiger konfiguriert sind.
 */
export async function loadAntragGenehmiger(
  adminClient: SupabaseClient
): Promise<AntragGenehmiger[]> {
  const { data, error } = await adminClient
    .from("antrag_genehmiger")
    .select(
      "user_id, user_profiles!antrag_genehmiger_user_id_fkey(id, email)"
    )
    .limit(50)

  if (error || !data) return []

  const result: AntragGenehmiger[] = []
  for (const row of data) {
    const profile = (row as unknown as {
      user_profiles: { id: string; email: string } | { id: string; email: string }[] | null
    }).user_profiles
    const p = Array.isArray(profile) ? profile[0] : profile
    if (p?.id && p?.email) {
      result.push({ id: p.id, email: p.email })
    }
  }
  return result
}

/**
 * Erzeugt Tokens pro Genehmiger, speichert sie in antrag_tokens und
 * versendet die Benachrichtigungs-E-Mails. Schlägt der Versand fehl,
 * wird das Ergebnis gezählt — der Aufrufer entscheidet über den Status.
 */
export async function issueAntragTokensAndSendEmails(
  adminClient: SupabaseClient,
  antrag: AntragDetails,
  genehmiger: AntragGenehmiger[]
): Promise<{ sent: number; failed: number }> {
  if (genehmiger.length === 0) return { sent: 0, failed: 0 }

  const tokenRows: Array<{
    antrag_id: string
    approver_user_id: string
    token_hash: string
    expires_at: string
  }> = []

  const emailJobs: Array<{ token: string; approverEmail: string }> = []

  for (const approver of genehmiger) {
    // Token-Logik aus PROJ-10 wiederverwenden — Rolle = "antrag"
    const { token, tokenHash, expiresAt } = generateApprovalToken(
      antrag.id,
      approver.id,
      "antrag"
    )
    tokenRows.push({
      antrag_id: antrag.id,
      approver_user_id: approver.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    })
    emailJobs.push({ token, approverEmail: approver.email })
  }

  const { error: insertError } = await adminClient
    .from("antrag_tokens")
    .insert(tokenRows)

  if (insertError) {
    throw new Error(
      `Antrag-Tokens konnten nicht gespeichert werden: ${insertError.message}`
    )
  }

  let sent = 0
  let failed = 0
  for (const job of emailJobs) {
    const result = await sendAntragApprovalRequestEmail({
      recipientEmail: job.approverEmail,
      applicantName: antrag.applicantName,
      applicantEmail: antrag.applicantEmail,
      amountCents: antrag.amountCents,
      purpose: antrag.purpose,
      createdAt: antrag.createdAt,
      documents: antrag.documents,
      decisionUrl: buildAntragDecisionUrl(job.token),
    })
    if (result.success) sent++
    else failed++
  }

  return { sent, failed }
}

/**
 * Wertet den Antragsstatus nach einer neuen Entscheidung aus.
 * Mehrheit reicht:
 *   - genehmigt, sobald mehr als N/2 Zustimmungen vorliegen
 *   - abgelehnt, sobald mehr als N/2 Ablehnungen vorliegen
 *   - abgelehnt, wenn alle abgestimmt haben und keine strikte Mehrheit
 *     zustande kam (Pattsituation bei gerader Anzahl)
 *   - sonst offen
 */
export function evaluateAntragStatus(
  totalGenehmiger: number,
  decisions: Array<{ decision: string }>
): "offen" | "genehmigt" | "abgelehnt" {
  if (totalGenehmiger <= 0) return "offen"

  const yes = decisions.filter((d) => d.decision === "genehmigt").length
  const no = decisions.filter((d) => d.decision === "abgelehnt").length
  const threshold = Math.floor(totalGenehmiger / 2) + 1

  if (yes >= threshold) return "genehmigt"
  if (no >= threshold) return "abgelehnt"

  // Alle haben abgestimmt, aber niemand hat eine strikte Mehrheit erreicht
  // (nur bei gerader Anzahl und exakter Pattsituation möglich).
  if (yes + no >= totalGenehmiger) return "abgelehnt"

  return "offen"
}
