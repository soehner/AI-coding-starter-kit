import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

/**
 * GET /api/admin/psd2/status
 * Liefert den aktuellen PSD2-Verbindungsstatus fuer die Einstellungen-Seite.
 */
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const adminClient = createAdminSupabaseClient()
  const { data: verbindung, error } = await adminClient
    .from("psd2_verbindungen")
    .select(
      "id, enablebanking_aspsp_name, enablebanking_aspsp_country, consent_gueltig_bis, letzter_abruf_am, letzter_abruf_status, letzter_abruf_fehler, aufeinanderfolgende_fehler, enablebanking_account_id, erstellt_am"
    )
    .order("erstellt_am", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: `Status konnte nicht gelesen werden: ${error.message}` },
      { status: 500 }
    )
  }

  if (!verbindung) {
    return NextResponse.json({
      verbunden: false,
      bereit: false,
    })
  }

  const bereit = !!verbindung.enablebanking_account_id
  let tageBisAblauf: number | null = null
  if (verbindung.consent_gueltig_bis) {
    const heute = new Date()
    heute.setUTCHours(0, 0, 0, 0)
    const ablauf = new Date(verbindung.consent_gueltig_bis + "T00:00:00Z")
    tageBisAblauf = Math.floor(
      (ablauf.getTime() - heute.getTime()) / (24 * 60 * 60 * 1000)
    )
  }

  return NextResponse.json({
    verbunden: true,
    bereit,
    // Für Anzeige "Verbunden mit BBBank" im Frontend (optional)
    aspsp_name: verbindung.enablebanking_aspsp_name,
    aspsp_country: verbindung.enablebanking_aspsp_country,
    // Beibehaltener Name für Abwärtskompatibilität zum Frontend
    institution_id: verbindung.enablebanking_aspsp_name,
    consent_gueltig_bis: verbindung.consent_gueltig_bis,
    tage_bis_ablauf: tageBisAblauf,
    letzter_abruf_am: verbindung.letzter_abruf_am,
    letzter_abruf_status: verbindung.letzter_abruf_status,
    letzter_abruf_fehler: verbindung.letzter_abruf_fehler,
    aufeinanderfolgende_fehler: verbindung.aufeinanderfolgende_fehler,
  })
}
