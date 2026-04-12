import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/admin-auth"

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
    document_url: string | null
    document_name: string | null
    required_roles: string[]
    link_type: string
    status: string
    created_at: string
    updated_at: string
    creator: Relation
    approval_documents: Array<{
      id: string
      document_url: string
      document_name: string
      display_order: number
    }>
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
    documents: (raw.approval_documents || [])
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map((d) => ({ id: d.id, url: d.document_url, name: d.document_name })),
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

/**
 * DELETE /api/approvals/[id]
 * Löscht einen Genehmigungsantrag samt Entscheidungen, Tokens und Dokument-Einträgen.
 * Nur für Admins. Dateien auf Seafile bleiben erhalten (könnten in Belegordner
 * archiviert bleiben) – hier wird nur der Datenbank-Eintrag entfernt.
 */
export async function DELETE(
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

  const adminResult = await requireAdmin()
  if (adminResult.error) return adminResult.error

  const adminClient = createAdminSupabaseClient()

  const { error: deleteError } = await adminClient
    .from("approval_requests")
    .delete()
    .eq("id", id)

  if (deleteError) {
    console.error("Antrag-Löschung fehlgeschlagen:", deleteError)
    return NextResponse.json(
      { error: "Antrag konnte nicht gelöscht werden." },
      { status: 500 }
    )
  }

  return NextResponse.json({ message: "Antrag gelöscht." })
}
