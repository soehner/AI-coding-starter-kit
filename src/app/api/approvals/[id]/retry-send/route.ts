import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { loadApprovers, findMissingRoles, issueTokensAndSendEmails } from "@/lib/approval-logic"

type ApprovalRoleType = "vorstand" | "zweiter_vorstand"

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ROLE_LABELS: Record<ApprovalRoleType, string> = {
  vorstand: "Vorstand",
  zweiter_vorstand: "2. Vorstand",
}

/**
 * POST /api/approvals/[id]/retry-send
 * Versucht den E-Mail-Versand für einen Antrag im Status "entwurf" erneut.
 * Bei Erfolg wird der Antrag auf "offen" gesetzt.
 *
 * BUG-6
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdmin()
  if (adminResult.error) return adminResult.error

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: "Ungültige Antrags-ID." },
      { status: 400 }
    )
  }

  const adminClient = createAdminSupabaseClient()

  // Antrag laden (inkl. Dokumente)
  const { data: request, error: loadError } = await adminClient
    .from("approval_requests")
    .select(
      `
      id, note, document_url, document_name, required_roles, link_type, status, created_by, created_at,
      approval_documents ( id, document_url, document_name, display_order )
      `
    )
    .eq("id", id)
    .single()

  if (loadError || !request) {
    return NextResponse.json(
      { error: "Antrag nicht gefunden." },
      { status: 404 }
    )
  }

  if (request.status !== "entwurf") {
    return NextResponse.json(
      {
        error: "Nur Anträge im Status Entwurf können erneut versendet werden.",
      },
      { status: 400 }
    )
  }

  const requiredRoles = request.required_roles as ApprovalRoleType[]

  const approvers = await loadApprovers(adminClient, requiredRoles)
  const missingRoles = findMissingRoles(approvers, requiredRoles)
  if (missingRoles.length > 0) {
    const names = missingRoles.map((r) => ROLE_LABELS[r]).join(" und ")
    return NextResponse.json(
      {
        error: `Es gibt keinen Benutzer mit der Rolle ${names}. Bitte weise die Rolle zuerst zu.`,
      },
      { status: 400 }
    )
  }

  // Ersteller-E-Mail für korrekten Absender-Kontext
  const { data: creator } = await adminClient
    .from("user_profiles")
    .select("email")
    .eq("id", request.created_by)
    .single()

  // Alte Tokens (falls vorhanden) löschen, um UNIQUE-Constraint nicht zu brechen
  await adminClient.from("approval_tokens").delete().eq("request_id", id)

  type DocRow = {
    id: string
    document_url: string
    document_name: string
    display_order: number
  }
  const docRows = ((request as unknown as { approval_documents: DocRow[] })
    .approval_documents ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)

  const documents =
    docRows.length > 0
      ? docRows.map((d) => ({ url: d.document_url, name: d.document_name }))
      : request.document_url && request.document_name
        ? [{ url: request.document_url, name: request.document_name }]
        : []

  if (documents.length === 0) {
    return NextResponse.json(
      { error: "Der Antrag enthält keine Belege." },
      { status: 400 }
    )
  }

  let result: { sent: number; failed: number }
  try {
    result = await issueTokensAndSendEmails(adminClient, {
      requestId: id,
      note: request.note,
      documents,
      createdAt: request.created_at,
      requesterEmail: creator?.email ?? adminResult.profile.email,
      approvers,
    })
  } catch (err) {
    console.error("Retry-Send fehlgeschlagen:", err)
    return NextResponse.json(
      { error: "E-Mail-Versand erneut fehlgeschlagen." },
      { status: 502 }
    )
  }

  if (result.sent === 0 && result.failed > 0) {
    return NextResponse.json(
      {
        error: "Keine E-Mail konnte versendet werden. Bitte später erneut versuchen.",
      },
      { status: 502 }
    )
  }

  // Status auf offen setzen
  await adminClient
    .from("approval_requests")
    .update({ status: "offen" })
    .eq("id", id)

  return NextResponse.json({
    message: `E-Mails versendet: ${result.sent} ok, ${result.failed} fehlgeschlagen.`,
    sent: result.sent,
    failed: result.failed,
  })
}
