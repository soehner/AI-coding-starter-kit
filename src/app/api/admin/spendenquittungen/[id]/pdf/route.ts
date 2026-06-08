import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { rendereAktuelleSpendenquittungPdf } from "@/lib/spendenquittung-render"

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/admin/spendenquittungen/[id]/pdf
 *
 * Liefert das PDF einer Quittung direkt als Datei-Stream aus.
 *
 * Das PDF wird bei jedem Abruf **frisch** aus den aktuellen Spenderdaten
 * und dem eingefrorenen Vereins-Snapshot gerendert. So zeigt die Ansicht
 * immer die neuesten Spenderdaten – auch wenn der Spender nach dem
 * Erstellen der Quittung korrigiert wurde.
 *
 * Sinn der Same-Origin-Auslieferung: Cross-Origin-iFrames mit
 * Supabase-Storage-URLs werden in vielen Browsern blockiert oder als
 * Download interpretiert. Indem wir das PDF über die App-eigene Domain
 * ausliefern und explizit `Content-Disposition: inline` setzen, lässt es
 * sich zuverlässig im `<iframe>` einbetten.
 *
 * Zugriff: Admin + Betrachter (Lesezugriff erlaubt – das PDF ist
 * Bestandteil der Vereinsdokumentation; RLS regelt Sichtbarkeit).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { error: "Ungültige Quittungs-ID." },
      { status: 400 }
    )
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert." },
      { status: 401 }
    )
  }

  // Zugriffsschutz: Mit dem authentifizierten Client (RLS) prüfen, ob der
  // Nutzer diese Quittung sehen darf. Eingeschränkte Betrachter (PROJ-14)
  // sehen nur erlaubte Quittungen.
  const { data: sichtbar, error: rlsError } = await supabase
    .from("spendenquittungen")
    .select("id")
    .eq("id", id)
    .single()

  if (rlsError || !sichtbar) {
    return NextResponse.json(
      { error: "Quittung nicht gefunden." },
      { status: 404 }
    )
  }

  // PDF frisch rendern. Der Admin-Client wird benötigt, weil der Spender-JOIN
  // RLS-geschützt ist (nur Admins lesen `spender` direkt) – die Sichtbarkeit
  // der Quittung selbst wurde oben bereits per RLS geprüft.
  const adminClient = createAdminSupabaseClient()
  const result = await rendereAktuelleSpendenquittungPdf(adminClient, id)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  // ?download=1 erzwingt einen Datei-Download statt Inline-Anzeige.
  const wantsDownload = request.nextUrl.searchParams.get("download") === "1"
  const disposition = wantsDownload ? "attachment" : "inline"
  const filename = `${result.quittungNummer}.pdf`

  return new NextResponse(new Uint8Array(result.pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(result.pdfBuffer.byteLength),
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      // Caching deaktivieren: das PDF wird bei jedem Abruf neu erzeugt und
      // spiegelt die aktuellen Spenderdaten wider.
      "Cache-Control": "private, no-store, max-age=0",
    },
  })
}
