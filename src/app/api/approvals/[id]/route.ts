import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/approvals/[id]
 * Einzelansicht eines Antrags inklusive aller Entscheidungen.
 * Sichtbar für alle eingeloggten Benutzer.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: "Ungültige Antrags-ID." },
      { status: 400 }
    )
  }

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

  const adminClient = createAdminSupabaseClient()

  const { data, error } = await adminClient
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
    .eq("id", id)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: "Antrag nicht gefunden." },
      { status: 404 }
    )
  }

  type Relation = { email: string } | { email: string }[] | null
  const unwrap = (rel: Relation): string | undefined =>
    Array.isArray(rel) ? rel[0]?.email : rel?.email

  const raw = data as unknown as {
    id: string
    created_by: string
    note: string
    document_url: string
    document_name: string
    required_roles: string[]
    link_type: string
    status: string
    created_at: string
    updated_at: string
    creator: Relation
    approval_decisions: Array<{
      id: string
      request_id: string
      approver_id: string
      approver_role: string
      decision: string
      comment: string | null
      decided_at: string
      approver: Relation
    }>
  }

  return NextResponse.json({
    id: raw.id,
    created_by: raw.created_by,
    created_by_email: unwrap(raw.creator),
    note: raw.note,
    document_url: raw.document_url,
    document_name: raw.document_name,
    required_roles: raw.required_roles,
    link_type: raw.link_type,
    status: raw.status,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    approval_decisions: (raw.approval_decisions || []).map((d) => ({
      id: d.id,
      request_id: d.request_id,
      approver_id: d.approver_id,
      approver_email: unwrap(d.approver),
      approver_role: d.approver_role,
      decision: d.decision,
      comment: d.comment,
      decided_at: d.decided_at,
    })),
  })
}
