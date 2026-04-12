import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

/**
 * GET /api/approvals
 * Liste aller Genehmigungsanträge — sichtbar für alle eingeloggten Benutzer.
 * Enthält Entscheidungen (Join) sowie E-Mail-Adressen der Ersteller und Genehmiger.
 */
export async function GET() {
  // Authentifizierung prüfen
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert." },
      { status: 401 }
    )
  }

  // Admin-Client für die Joins nutzen, um E-Mails zuverlässig mitzuladen
  const adminClient = createAdminSupabaseClient()

  const { data: requests, error: requestsError } = await adminClient
    .from("approval_requests")
    .select(
      `
      id,
      created_by,
      note,
      document_url,
      document_name,
      required_roles,
      link_type,
      status,
      created_at,
      updated_at,
      creator:user_profiles!approval_requests_created_by_fkey ( email ),
      approval_documents (
        id,
        document_url,
        document_name,
        display_order
      ),
      approval_decisions (
        id,
        request_id,
        approver_id,
        approver_role,
        decision,
        comment,
        decided_at,
        approver:user_profiles!approval_decisions_approver_id_fkey ( email )
      )
      `
    )
    .order("created_at", { ascending: false })
    .limit(200)

  if (requestsError) {
    console.error("Fehler beim Laden der Anträge:", requestsError)
    return NextResponse.json(
      { error: "Anträge konnten nicht geladen werden." },
      { status: 500 }
    )
  }

  type RawDecision = {
    id: string
    request_id: string
    approver_id: string
    approver_role: string
    decision: string
    comment: string | null
    decided_at: string
    approver: { email: string } | { email: string }[] | null
  }

  type RawDocument = {
    id: string
    document_url: string
    document_name: string
    display_order: number
  }

  type RawRequest = {
    id: string
    created_by: string
    note: string
    document_url: string | null
    document_name: string | null
    required_roles: string[]
    link_type: string
    status: string
    created_at: string
    updated_at: string
    creator: { email: string } | { email: string }[] | null
    approval_documents: RawDocument[]
    approval_decisions: RawDecision[]
  }

  const unwrapEmail = (
    relation: { email: string } | { email: string }[] | null
  ): string | undefined => {
    if (!relation) return undefined
    if (Array.isArray(relation)) return relation[0]?.email
    return relation.email
  }

  const result = ((requests as RawRequest[]) || []).map((r) => ({
    id: r.id,
    created_by: r.created_by,
    created_by_email: unwrapEmail(r.creator),
    note: r.note,
    document_url: r.document_url,
    document_name: r.document_name,
    documents: (r.approval_documents || [])
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map((d) => ({
        id: d.id,
        url: d.document_url,
        name: d.document_name,
      })),
    required_roles: r.required_roles,
    link_type: r.link_type,
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at,
    approval_decisions: (r.approval_decisions || []).map((d) => ({
      id: d.id,
      request_id: d.request_id,
      approver_id: d.approver_id,
      approver_email: unwrapEmail(d.approver),
      approver_role: d.approver_role,
      decision: d.decision,
      comment: d.comment,
      decided_at: d.decided_at,
    })),
  }))

  return NextResponse.json(result)
}
