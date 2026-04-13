import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { listAspsps } from "@/lib/psd2/enablebanking-client"

/**
 * GET /api/admin/psd2/aspsps?country=DE
 * Diagnose-Endpunkt: Listet alle bei Enable Banking verfügbaren ASPSPs
 * (inklusive Mock ASPSP im Sandbox) für das angegebene Land.
 *
 * Nützlich, um den exakten Namen für ENABLEBANKING_ASPSP_NAME herauszufinden.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const country = searchParams.get("country") ?? "DE"
  const filter = searchParams.get("filter")?.toLowerCase() ?? null

  try {
    const aspsps = await listAspsps(country)
    const gefiltert = filter
      ? aspsps.filter((a) => a.name.toLowerCase().includes(filter))
      : aspsps
    return NextResponse.json({
      country,
      filter,
      anzahl_gesamt: aspsps.length,
      anzahl_treffer: gefiltert.length,
      aspsps: gefiltert.map((a) => ({
        name: a.name,
        country: a.country,
        psu_types: a.psu_types,
      })),
    })
  } catch (fehler) {
    const meldung =
      fehler instanceof Error ? fehler.message : "Unbekannter Fehler"
    return NextResponse.json(
      { error: `ASPSP-Liste konnte nicht geladen werden: ${meldung}` },
      { status: 500 }
    )
  }
}
