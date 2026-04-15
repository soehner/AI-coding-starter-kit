import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { genehmigerPoolUpdateSchema } from "@/lib/validations/antrag"

/**
 * GET /api/admin/antrag-genehmiger
 * Liefert die aktuell konfigurierten Antrag-Genehmiger (User-IDs + E-Mails).
 */
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const adminClient = createAdminSupabaseClient()

  const { data, error } = await adminClient
    .from("antrag_genehmiger")
    .select(
      "user_id, added_at, user_profiles!antrag_genehmiger_user_id_fkey(id, email)"
    )
    .limit(50)

  if (error) {
    console.error("Fehler beim Laden des Genehmiger-Pools:", error)
    return NextResponse.json(
      { error: "Genehmiger konnten nicht geladen werden." },
      { status: 500 }
    )
  }

  const result = (data ?? []).map((row) => {
    const r = row as unknown as {
      user_id: string
      added_at: string
      user_profiles: { id: string; email: string } | { id: string; email: string }[] | null
    }
    const profile = Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles
    return {
      user_id: r.user_id,
      email: profile?.email ?? "",
      added_at: r.added_at,
    }
  })

  return NextResponse.json(result)
}

/**
 * PUT /api/admin/antrag-genehmiger
 * Ersetzt den Genehmiger-Pool durch die übergebene Liste von user_ids.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage." },
      { status: 400 }
    )
  }

  const parsed = genehmigerPoolUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validierungsfehler." },
      { status: 400 }
    )
  }

  const { user_ids } = parsed.data
  const adminClient = createAdminSupabaseClient()

  // Sicherstellen, dass alle IDs gültige User-Profile sind
  if (user_ids.length > 0) {
    const { data: profiles, error: profileError } = await adminClient
      .from("user_profiles")
      .select("id")
      .in("id", user_ids)

    if (profileError) {
      return NextResponse.json(
        { error: "Benutzer konnten nicht geprüft werden." },
        { status: 500 }
      )
    }
    if ((profiles?.length ?? 0) !== user_ids.length) {
      return NextResponse.json(
        { error: "Mindestens ein ausgewählter Benutzer existiert nicht." },
        { status: 400 }
      )
    }
  }

  // Pool komplett neu schreiben (Delete + Insert)
  const { error: deleteError } = await adminClient
    .from("antrag_genehmiger")
    .delete()
    .not("user_id", "is", null)

  if (deleteError) {
    console.error("Pool-Delete-Fehler:", deleteError)
    return NextResponse.json(
      { error: "Genehmiger-Pool konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }

  if (user_ids.length > 0) {
    const rows = user_ids.map((id) => ({
      user_id: id,
      added_by: auth.profile.id,
    }))
    const { error: insertError } = await adminClient
      .from("antrag_genehmiger")
      .insert(rows)

    if (insertError) {
      console.error("Pool-Insert-Fehler:", insertError)
      return NextResponse.json(
        { error: "Genehmiger konnten nicht gespeichert werden." },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ success: true, count: user_ids.length })
}
