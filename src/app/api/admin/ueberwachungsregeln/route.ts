import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createUeberwachungsregelSchema } from "@/lib/validations/ueberwachungsregeln"
import { beschreibeUeberwachungsregel } from "@/lib/ueberwachungsregeln"
import type { Ueberwachungsregel } from "@/lib/types"

const SELECT_COLUMNS =
  "id, name, freitext_original, regel_typ, bedingung, empfaenger, ist_aktiv, sortierung, erstellt_am, erstellt_von"

/**
 * GET /api/admin/ueberwachungsregeln
 * Liefert alle Überwachungsregeln (sortiert). Ergänzt jede Regel um eine
 * Klartext-Zusammenfassung. Nur Admins.
 */
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("ueberwachungsregeln")
      .select(SELECT_COLUMNS)
      .order("sortierung", { ascending: true })
      .order("erstellt_am", { ascending: true })
      .limit(500)

    if (error) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Regeln: " + error.message },
        { status: 500 }
      )
    }

    const regeln = ((data ?? []) as Ueberwachungsregel[]).map((r) => ({
      ...r,
      zusammenfassung: beschreibeUeberwachungsregel(r.regel_typ, r.bedingung),
    }))

    return NextResponse.json({ regeln })
  } catch (err) {
    console.error("GET /api/admin/ueberwachungsregeln Fehler:", err)
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 })
  }
}

/**
 * POST /api/admin/ueberwachungsregeln
 * Legt eine neue Regel an (bereits übersetzte & bestätigte Bedingung).
 * Nur Admins.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { error: "Ungültiger Request-Body." },
        { status: 400 }
      )
    }

    const validation = createUeberwachungsregelSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Nächste Sortierung bestimmen (rein kosmetisch, kein Lock nötig).
    const { data: maxRow } = await supabase
      .from("ueberwachungsregeln")
      .select("sortierung")
      .order("sortierung", { ascending: false })
      .limit(1)
      .maybeSingle()

    const naechsteSortierung =
      typeof maxRow?.sortierung === "number" ? maxRow.sortierung + 1 : 0

    const { regel_typ, combinator, criteria, muster } =
      validation.data.bedingung
    const bedingung = {
      combinator,
      criteria,
      ...(muster ? { muster } : {}),
    }

    const { data, error } = await supabase
      .from("ueberwachungsregeln")
      .insert({
        name: validation.data.name,
        freitext_original: validation.data.freitext_original ?? null,
        regel_typ,
        bedingung,
        empfaenger: validation.data.empfaenger,
        ist_aktiv: validation.data.ist_aktiv ?? true,
        sortierung: naechsteSortierung,
        erstellt_von: auth.profile.id,
      })
      .select(SELECT_COLUMNS)
      .single()

    if (error || !data) {
      return NextResponse.json(
        {
          error:
            "Fehler beim Anlegen der Regel: " +
            (error?.message ?? "Unbekannter Fehler."),
        },
        { status: 500 }
      )
    }

    const regel = data as Ueberwachungsregel
    return NextResponse.json(
      {
        regel: {
          ...regel,
          zusammenfassung: beschreibeUeberwachungsregel(
            regel.regel_typ,
            regel.bedingung
          ),
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error("POST /api/admin/ueberwachungsregeln Fehler:", err)
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 })
  }
}
