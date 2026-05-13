import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { spenderUpdateSchema } from "@/lib/validations/spender"

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * PATCH /api/admin/spender/[id]
 * Bearbeitet die Daten eines Spenders.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { id } = await params
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { error: "Ungültige Spender-ID." },
      { status: 400 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 }
    )
  }

  const validation = spenderUpdateSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Ungültige Eingabe." },
      { status: 400 }
    )
  }

  const data = validation.data
  const supabase = createAdminSupabaseClient()

  // Update-Payload: leere Strings als NULL behandeln (DSGVO/Datenhygiene)
  const updatePayload: Record<string, string | null> = {}
  if (data.name !== undefined) updatePayload.name = data.name
  if (data.strasse !== undefined) updatePayload.strasse = data.strasse || null
  if (data.plz !== undefined) updatePayload.plz = data.plz || null
  if (data.ort !== undefined) updatePayload.ort = data.ort || null
  if (data.email !== undefined) updatePayload.email = data.email || null
  if (data.iban !== undefined) updatePayload.iban = data.iban || null

  const { data: updated, error } = await supabase
    .from("spender")
    .update(updatePayload)
    .eq("id", id)
    .select(
      "id, name, strasse, plz, ort, email, iban, created_at, updated_at"
    )
    .single()

  if (error) {
    console.error("Fehler beim Aktualisieren des Spenders:", error.message)
    return NextResponse.json(
      { error: "Spender konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }

  if (!updated) {
    return NextResponse.json(
      { error: "Spender nicht gefunden." },
      { status: 404 }
    )
  }

  return NextResponse.json({ spender: updated })
}

/**
 * DELETE /api/admin/spender/[id]
 * Löscht einen Spender (DSGVO-Recht auf Vergessenwerden).
 *
 * Sicherheitsnetz: Wenn der Spender noch in mindestens einer
 * spendenquittungen-Zeile referenziert ist, wird das Löschen verweigert,
 * weil sonst die ON DELETE RESTRICT-Constraint feuert und die Historie
 * fehlerhaft bliebe. Der Admin muss dann zuerst die Quittungen archivieren
 * oder den Spender anonymisieren.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { id } = await params
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { error: "Ungültige Spender-ID." },
      { status: 400 }
    )
  }

  const supabase = createAdminSupabaseClient()

  // Prüfen, ob noch Quittungen vorhanden sind
  const { count, error: countError } = await supabase
    .from("spendenquittungen")
    .select("id", { count: "exact", head: true })
    .eq("spender_id", id)

  if (countError) {
    console.error(
      "Fehler beim Prüfen vorhandener Quittungen:",
      countError.message
    )
    return NextResponse.json(
      { error: "Spender konnte nicht gelöscht werden." },
      { status: 500 }
    )
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Spender hat noch ausgestellte Quittungen und kann nicht gelöscht werden. Bitte anonymisieren statt löschen.",
      },
      { status: 409 }
    )
  }

  const { error } = await supabase.from("spender").delete().eq("id", id)

  if (error) {
    console.error("Fehler beim Löschen des Spenders:", error.message)
    return NextResponse.json(
      { error: "Spender konnte nicht gelöscht werden." },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, id })
}
