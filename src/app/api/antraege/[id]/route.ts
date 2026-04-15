import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { updateAntragSchema } from "@/lib/validations/antrag"

/**
 * PATCH /api/antraege/[id]
 * Bearbeitet die Stammdaten eines Antrags (Admin-only).
 * Status, Entscheidungen, Tokens und Anhänge werden NICHT angefasst.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "ID fehlt." }, { status: 400 })
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

  const parsed = updateAntragSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validierungsfehler." },
      { status: 400 }
    )
  }

  const { firstName, lastName, email, amount, purpose } = parsed.data
  const adminClient = createAdminSupabaseClient()

  const { error } = await adminClient
    .from("antraege")
    .update({
      applicant_first_name: firstName,
      applicant_last_name: lastName,
      applicant_email: email.toLowerCase(),
      amount_cents: Math.round(amount * 100),
      purpose,
    })
    .eq("id", id)

  if (error) {
    console.error("Antrag-Update-Fehler:", error)
    return NextResponse.json(
      { error: "Antrag konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

/**
 * DELETE /api/antraege/[id]
 * Löscht einen Antrag inkl. abhängiger Tokens, Entscheidungen und
 * Dokument-Datensätze (CASCADE in der DB). Admin-only.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "ID fehlt." }, { status: 400 })
  }

  const adminClient = createAdminSupabaseClient()
  const { error } = await adminClient.from("antraege").delete().eq("id", id)

  if (error) {
    console.error("Antrag-Delete-Fehler:", error)
    return NextResponse.json(
      { error: "Antrag konnte nicht gelöscht werden." },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
