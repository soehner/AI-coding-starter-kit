import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PDF_BUCKET = "spendenquittungen"

/**
 * GET /api/admin/spendenquittungen/[id]/pdf
 *
 * Liefert das PDF einer Quittung direkt als Datei-Stream aus.
 *
 * Sinn: Cross-Origin-iFrames mit Supabase-Storage-URLs werden in vielen
 * Browsern blockiert oder als Download interpretiert. Indem wir das PDF
 * über die App-eigene Domain ausliefern (Same-Origin) und explizit
 * `Content-Disposition: inline` setzen, lässt es sich zuverlässig im
 * `<iframe>` einbetten.
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

  // Pfad zur PDF-Datei laden – RLS verhindert Zugriff auf fremde Quittungen.
  const { data: quittung, error } = await supabase
    .from("spendenquittungen")
    .select("quittung_nummer, pdf_path")
    .eq("id", id)
    .single()

  if (error || !quittung) {
    return NextResponse.json(
      { error: "Quittung nicht gefunden." },
      { status: 404 }
    )
  }

  // PDF aus privatem Storage laden (Admin-Client, da Bucket privat ist)
  const adminClient = createAdminSupabaseClient()
  const { data: file, error: downloadError } = await adminClient.storage
    .from(PDF_BUCKET)
    .download(quittung.pdf_path)

  if (downloadError || !file) {
    console.error(
      "PDF-Download aus Storage fehlgeschlagen:",
      downloadError?.message
    )
    return NextResponse.json(
      { error: "PDF konnte nicht geladen werden." },
      { status: 500 }
    )
  }

  const arrayBuffer = await file.arrayBuffer()

  // ?download=1 erzwingt einen Datei-Download statt Inline-Anzeige.
  const wantsDownload = request.nextUrl.searchParams.get("download") === "1"
  const disposition = wantsDownload ? "attachment" : "inline"
  const filename = `${quittung.quittung_nummer}.pdf`

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(arrayBuffer.byteLength),
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      // Caching deaktivieren: das PDF kann nach Bearbeitung ersetzt werden.
      "Cache-Control": "private, no-store, max-age=0",
    },
  })
}
