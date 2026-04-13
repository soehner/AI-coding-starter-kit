import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/require-permission"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { abgleichEntscheidungSchema } from "@/lib/validations/psd2"

/**
 * POST /api/transactions/[id]/abgleich
 *
 * Der Kassenwart entscheidet ueber einen "vorschlag" (Fuzzy-Match):
 *  - 'bestaetigt' → beide Eintraege werden zu einem gemerged
 *    (der PDF-Eintrag bleibt, der PSD2-Eintrag wird geloescht,
 *     quelle='beide', status='bestaetigt')
 *  - 'getrennt'  → beide Eintraege bleiben getrennt, die nicht_matchen_mit-
 *     Blockliste wird aktualisiert, damit sie nie wieder zusammengefuehrt
 *     werden.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("edit_transactions")
  if (auth.error) return auth.error

  const { id } = await params
  if (!id) {
    return NextResponse.json(
      { error: "Transaktions-ID fehlt." },
      { status: 400 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body." },
      { status: 400 }
    )
  }

  const validation = abgleichEntscheidungSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Ungueltige Eingabe." },
      { status: 400 }
    )
  }

  const { entscheidung, partner_id } = validation.data
  const adminClient = createAdminSupabaseClient()

  // Beide Eintraege laden
  const { data: eintraege, error: loadError } = await adminClient
    .from("transactions")
    .select("id, quelle, status, matching_hash, nicht_matchen_mit, psd2_original_data, psd2_abgerufen_am")
    .in("id", [id, partner_id])

  if (loadError || !eintraege || eintraege.length !== 2) {
    return NextResponse.json(
      { error: "Eintraege nicht gefunden oder unvollstaendig." },
      { status: 404 }
    )
  }

  if (entscheidung === "bestaetigt") {
    // Merge: PDF-Eintrag wird primaer (Source of Truth), PSD2-Eintrag wird geloescht
    const pdf = eintraege.find((e) => e.quelle === "pdf")
    const psd2 = eintraege.find((e) => e.quelle === "psd2")

    if (!pdf || !psd2) {
      return NextResponse.json(
        {
          error:
            "Fuer eine Bestaetigung muss genau ein PDF- und ein PSD2-Eintrag ausgewaehlt sein.",
        },
        { status: 400 }
      )
    }

    const { error: updateError } = await adminClient
      .from("transactions")
      .update({
        quelle: "beide",
        status: "bestaetigt",
        psd2_abgerufen_am: psd2.psd2_abgerufen_am,
        psd2_original_data: psd2.psd2_original_data,
      })
      .eq("id", pdf.id)

    if (updateError) {
      return NextResponse.json(
        { error: `Update fehlgeschlagen: ${updateError.message}` },
        { status: 500 }
      )
    }

    const { error: deleteError } = await adminClient
      .from("transactions")
      .delete()
      .eq("id", psd2.id)

    if (deleteError) {
      return NextResponse.json(
        {
          error: `PSD2-Eintrag konnte nicht geloescht werden: ${deleteError.message}`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: "Eintraege erfolgreich zusammengefuehrt." })
  }

  // getrennt: beide Eintraege behalten, Blockliste aktualisieren
  for (const eintrag of eintraege) {
    const andereId = eintrag.id === id ? partner_id : id
    const aktuelleListe = (eintrag.nicht_matchen_mit as string[] | null) ?? []
    if (aktuelleListe.includes(andereId)) continue
    const neueListe = [...aktuelleListe, andereId]

    // Vorschlag-Status zuruecksetzen auf nur_pdf/nur_psd2
    const neuerStatus = eintrag.quelle === "pdf" ? "nur_pdf" : "nur_psd2"

    const { error: updateError } = await adminClient
      .from("transactions")
      .update({
        nicht_matchen_mit: neueListe,
        status: neuerStatus,
      })
      .eq("id", eintrag.id)

    if (updateError) {
      return NextResponse.json(
        { error: `Update fehlgeschlagen: ${updateError.message}` },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    message: "Eintraege als getrennt markiert. Sie werden nicht mehr automatisch zusammengefuehrt.",
  })
}
