import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/require-permission"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { decrypt } from "@/lib/encryption"
import {
  loadSeafileConfig,
  uploadToSeafile,
  deleteFromSeafile,
  generateReceiptFileName,
  isSeafileOfficeFile,
  forceSeafileDownloadLink,
} from "@/lib/seafile"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * POST /api/transactions/[id]/document
 * Lädt einen Beleg auf Seafile hoch und speichert den Share-Link in document_ref.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const auth = await requirePermission("edit_transactions")
    if (auth.error) return auth.error

    const adminClient = createAdminSupabaseClient()

    // 1. Seafile-Konfiguration laden
    const seafileResult = await loadSeafileConfig(adminClient, decrypt)
    if (!seafileResult) {
      return NextResponse.json(
        { error: "Seafile ist nicht konfiguriert. Bitte in den Einstellungen konfigurieren." },
        { status: 400 }
      )
    }

    // 2. FormData lesen
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { error: "Ungültiger Request. FormData erwartet." },
        { status: 400 }
      )
    }

    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json(
        { error: "Keine Datei hochgeladen." },
        { status: 400 }
      )
    }

    // 3. Datei-Größe validieren — Dateityp ist bewusst frei,
    // damit der Kassenwart auch Office-Dokumente o. ä. als Beleg ablegen kann.
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Datei zu groß. Maximal 10 MB erlaubt." },
        { status: 400 }
      )
    }

    // 4. Transaktion laden (für Buchungsdatum und -text)
    const { data: transaction, error: txError } = await adminClient
      .from("transactions")
      .select("id, booking_date, description, document_ref")
      .eq("id", id)
      .single()

    if (txError || !transaction) {
      return NextResponse.json(
        { error: "Buchung nicht gefunden." },
        { status: 404 }
      )
    }

    // 5. Falls bereits ein Beleg existiert, alten auf Seafile löschen
    // (Der alte Share-Link reicht nicht zum Löschen — wir müssen den Dateipfad kennen.
    //  Da wir keinen separaten Pfad speichern, überspringen wir das Löschen der alten Datei.
    //  Die alte Datei bleibt auf Seafile, der Link wird ersetzt.)

    // 6. Dateiname generieren
    const year = transaction.booking_date.substring(0, 4)
    const fileName = generateReceiptFileName(
      transaction.booking_date,
      transaction.description,
      file.name
    )

    // 7. Datei auf Seafile hochladen
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    const { shareLink } = await uploadToSeafile(
      seafileResult.config,
      seafileResult.receiptPath,
      year,
      fileName,
      fileBuffer,
      file.type || "application/octet-stream"
    )

    // Office-Dateien würden von Seafile per Collabora/OnlyOffice-Vorschau
    // geöffnet — auf Servern ohne Document-Server scheitert das. Für diese
    // Dateien erzwingen wir den direkten Download über ?dl=1.
    const finalLink = isSeafileOfficeFile(file.name)
      ? forceSeafileDownloadLink(shareLink)
      : shareLink

    // 8. Share-Link in document_ref speichern
    const { error: updateError } = await adminClient
      .from("transactions")
      .update({
        document_ref: finalLink,
        updated_at: new Date().toISOString(),
        updated_by: auth.profile.id,
      })
      .eq("id", id)

    if (updateError) {
      console.error("Fehler beim Speichern des Beleg-Links:", updateError.message)
      return NextResponse.json(
        { error: "Beleg wurde hochgeladen, aber der Link konnte nicht gespeichert werden." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: "Beleg erfolgreich hochgeladen.",
      document_ref: finalLink,
    })
  } catch (error) {
    console.error("Document Upload Fehler:", error)
    const message = error instanceof Error ? error.message : "Interner Serverfehler"
    return NextResponse.json(
      { error: `Fehler beim Hochladen: ${message}` },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/transactions/[id]/document
 * Entfernt den Beleg-Link aus der Transaktion.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const auth = await requirePermission("edit_transactions")
    if (auth.error) return auth.error

    const adminClient = createAdminSupabaseClient()

    // Transaktion prüfen
    const { data: transaction, error: txError } = await adminClient
      .from("transactions")
      .select("id, document_ref")
      .eq("id", id)
      .single()

    if (txError || !transaction) {
      return NextResponse.json(
        { error: "Buchung nicht gefunden." },
        { status: 404 }
      )
    }

    if (!transaction.document_ref) {
      return NextResponse.json(
        { error: "Kein Beleg vorhanden." },
        { status: 400 }
      )
    }

    // Beleg-Link aus Transaktion entfernen
    const { error: updateError } = await adminClient
      .from("transactions")
      .update({
        document_ref: null,
        updated_at: new Date().toISOString(),
        updated_by: auth.profile.id,
      })
      .eq("id", id)

    if (updateError) {
      console.error("Fehler beim Entfernen des Beleg-Links:", updateError.message)
      return NextResponse.json(
        { error: "Beleg-Link konnte nicht entfernt werden." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: "Beleg-Link erfolgreich entfernt.",
    })
  } catch (error) {
    console.error("Document DELETE Fehler:", error)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
