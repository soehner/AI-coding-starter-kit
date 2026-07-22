import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { updateUeberwachungsregelSchema } from "@/lib/validations/ueberwachungsregeln"
import { beschreibeUeberwachungsregel } from "@/lib/ueberwachungsregeln"
import type { Ueberwachungsregel } from "@/lib/types"

const paramsSchema = z.object({
  id: z.string().uuid("Ungültige Regel-ID."),
})

const SELECT_COLUMNS =
  "id, name, freitext_original, regel_typ, bedingung, empfaenger, ist_aktiv, sortierung, erstellt_am, erstellt_von"

/**
 * PATCH /api/admin/ueberwachungsregeln/[id]
 *
 * PROJ-18: Aktualisiert Name, Bedingung, Empfänger, Aktiv-Status oder
 * Sortierung. Beim Ändern der Bedingung wird die ganze (validierte)
 * Bedingung als Atom ersetzt. Nur Admins.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  try {
    const rawParams = await params
    const paramCheck = paramsSchema.safeParse(rawParams)
    if (!paramCheck.success) {
      return NextResponse.json(
        { error: paramCheck.error.issues[0]?.message ?? "Ungültige ID." },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { error: "Ungültiger Request-Body." },
        { status: 400 }
      )
    }

    const validation = updateUeberwachungsregelSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    const { data: existing, error: loadErr } = await supabase
      .from("ueberwachungsregeln")
      .select("id")
      .eq("id", paramCheck.data.id)
      .maybeSingle()

    if (loadErr) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Regel: " + loadErr.message },
        { status: 500 }
      )
    }
    if (!existing) {
      return NextResponse.json({ error: "Regel nicht gefunden." }, { status: 404 })
    }

    const updatePayload: Record<string, unknown> = {}
    if (validation.data.name !== undefined) {
      updatePayload.name = validation.data.name
    }
    if (validation.data.freitext_original !== undefined) {
      updatePayload.freitext_original = validation.data.freitext_original
    }
    if (validation.data.empfaenger !== undefined) {
      updatePayload.empfaenger = validation.data.empfaenger
    }
    if (validation.data.ist_aktiv !== undefined) {
      updatePayload.ist_aktiv = validation.data.ist_aktiv
    }
    if (validation.data.sortierung !== undefined) {
      updatePayload.sortierung = validation.data.sortierung
    }
    if (validation.data.bedingung !== undefined) {
      const { regel_typ, combinator, criteria, muster } =
        validation.data.bedingung
      updatePayload.regel_typ = regel_typ
      updatePayload.bedingung = {
        combinator,
        criteria,
        ...(muster ? { muster } : {}),
      }
    }

    const { data, error } = await supabase
      .from("ueberwachungsregeln")
      .update(updatePayload)
      .eq("id", paramCheck.data.id)
      .select(SELECT_COLUMNS)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Regel nicht gefunden." },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: "Fehler beim Aktualisieren der Regel: " + error.message },
        { status: 500 }
      )
    }

    const regel = data as Ueberwachungsregel
    return NextResponse.json({
      regel: {
        ...regel,
        zusammenfassung: beschreibeUeberwachungsregel(
          regel.regel_typ,
          regel.bedingung
        ),
      },
    })
  } catch (err) {
    console.error("PATCH /api/admin/ueberwachungsregeln/[id] Fehler:", err)
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/ueberwachungsregeln/[id]
 * Löscht eine Regel. Die Benachrichtigungs-Historie bleibt erhalten
 * (regel_id wird per ON DELETE SET NULL entkoppelt). Nur Admins.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  try {
    const rawParams = await params
    const paramCheck = paramsSchema.safeParse(rawParams)
    if (!paramCheck.success) {
      return NextResponse.json(
        { error: paramCheck.error.issues[0]?.message ?? "Ungültige ID." },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from("ueberwachungsregeln")
      .delete()
      .eq("id", paramCheck.data.id)

    if (error) {
      return NextResponse.json(
        { error: "Fehler beim Löschen der Regel: " + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/admin/ueberwachungsregeln/[id] Fehler:", err)
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 })
  }
}
