import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

/**
 * GET /api/admin/cost-requests
 * Admin-Übersicht aller Kostenübernahme-Anträge.
 * Unterstützt Filter: ?status=offen|genehmigt|abgelehnt
 */
export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin()
  if (adminResult.error) return adminResult.error

  const supabase = createAdminSupabaseClient()
  const status = request.nextUrl.searchParams.get("status")

  let query = supabase
    .from("cost_requests")
    .select(
      `
      id,
      applicant_first_name,
      applicant_last_name,
      applicant_email,
      amount_cents,
      purpose,
      status,
      email_status,
      decided_at,
      created_at,
      cost_request_votes (
        approval_role,
        decision,
        voted_at
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(100)

  if (status && ["offen", "genehmigt", "abgelehnt"].includes(status)) {
    query = query.eq("status", status)
  }

  const { data, error } = await query

  if (error) {
    console.error("Fehler beim Laden der Anträge:", error)
    return NextResponse.json(
      { error: "Fehler beim Laden der Anträge." },
      { status: 500 }
    )
  }

  return NextResponse.json({ requests: data || [] })
}
