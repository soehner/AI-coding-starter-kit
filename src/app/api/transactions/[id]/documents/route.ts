import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/require-permission"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { decrypt } from "@/lib/encryption"
import {
  loadSeafileConfig,
  uploadToSeafile,
  generateReceiptFileName,
  isSeafileOfficeFile,
  forceSeafileDownloadLink,
} from "@/lib/seafile"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES_PER_TRANSACTION = 5

/**
 * POST /api/transactions/[id]/documents
 * Lädt einen oder mehrere Belege für eine Buchung auf Seafile hoch und legt
 * pro Datei eine Zeile in `transaction_documents` an. Die Gesamtzahl der
 * Belege pro Buchung ist auf MAX_FILES_PER_TRANSACTION begrenzt.
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
        {
          error:
            "Seafile ist nicht konfiguriert. Bitte in den Einstellungen konfigurieren.",
        },
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

    const rawFiles = formData.getAll("files")
    const files = rawFiles.filter(
      (f): f is File => f instanceof File && f.size > 0
    )

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Keine Datei hochgeladen." },
        { status: 400 }
      )
    }

    if (files.length > MAX_FILES_PER_TRANSACTION) {
      return NextResponse.json(
        {
          error: `Maximal ${MAX_FILES_PER_TRANSACTION} Belege pro Buchung erlaubt.`,
        },
        { status: 400 }
      )
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `Die Datei "${file.name}" ist zu groß. Maximal 10 MB pro Datei erlaubt.`,
          },
          { status: 400 }
        )
      }
    }

    // 3. Transaktion laden
    const { data: transaction, error: txError } = await adminClient
      .from("transactions")
      .select("id, booking_date, description")
      .eq("id", id)
      .single()

    if (txError || !transaction) {
      return NextResponse.json(
        { error: "Buchung nicht gefunden." },
        { status: 404 }
      )
    }

    // 4. Bestehende Belege zählen (Obergrenze inkl. Altbestand durchsetzen)
    const { count: existingCount, error: countError } = await adminClient
      .from("transaction_documents")
      .select("id", { count: "exact", head: true })
      .eq("transaction_id", id)

    if (countError) {
      console.error("Fehler beim Zählen der Belege:", countError.message)
      return NextResponse.json(
        { error: "Bestehende Belege konnten nicht geprüft werden." },
        { status: 500 }
      )
    }

    const currentCount = existingCount ?? 0
    if (currentCount + files.length > MAX_FILES_PER_TRANSACTION) {
      return NextResponse.json(
        {
          error: `Es sind bereits ${currentCount} Belege vorhanden. Maximal ${MAX_FILES_PER_TRANSACTION} erlaubt.`,
        },
        { status: 400 }
      )
    }

    const year = transaction.booking_date.substring(0, 4)

    // 5. Dateien auf Seafile hochladen
    type UploadedDoc = {
      document_url: string
      document_name: string
      document_path: string
    }
    const uploaded: UploadedDoc[] = []

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()
      const fileBuffer = Buffer.from(arrayBuffer)

      const fileName = generateReceiptFileName(
        transaction.booking_date,
        transaction.description,
        file.name
      )

      try {
        const { shareLink, filePath } = await uploadToSeafile(
          seafileResult.config,
          seafileResult.receiptPath,
          year,
          fileName,
          fileBuffer,
          file.type || "application/octet-stream"
        )

        const finalLink = isSeafileOfficeFile(file.name)
          ? forceSeafileDownloadLink(shareLink)
          : shareLink

        uploaded.push({
          document_url: finalLink,
          document_name: file.name,
          document_path: filePath,
        })
      } catch (err) {
        console.error("Seafile-Upload fehlgeschlagen:", err)
        return NextResponse.json(
          {
            error: `Die Datei "${file.name}" konnte nicht hochgeladen werden.`,
          },
          { status: 502 }
        )
      }
    }

    // 6. Datensätze in transaction_documents anlegen
    const insertRows = uploaded.map((doc, index) => ({
      transaction_id: id,
      document_url: doc.document_url,
      document_name: doc.document_name,
      document_path: doc.document_path,
      display_order: currentCount + index,
      created_by: auth.profile.id,
    }))

    const { data: insertedDocs, error: insertError } = await adminClient
      .from("transaction_documents")
      .insert(insertRows)
      .select("id, document_url, document_name, display_order, created_at")

    if (insertError) {
      console.error("Fehler beim Speichern der Beleg-Datensätze:", insertError.message)
      return NextResponse.json(
        {
          error:
            "Belege wurden hochgeladen, konnten aber nicht gespeichert werden.",
        },
        { status: 500 }
      )
    }

    // 7. Audit-Felder auf der Transaktion aktualisieren
    await adminClient
      .from("transactions")
      .update({
        updated_at: new Date().toISOString(),
        updated_by: auth.profile.id,
      })
      .eq("id", id)

    return NextResponse.json({
      message: "Belege erfolgreich hochgeladen.",
      documents: insertedDocs ?? [],
    })
  } catch (error) {
    console.error("Documents Upload Fehler:", error)
    const message = error instanceof Error ? error.message : "Interner Serverfehler"
    return NextResponse.json(
      { error: `Fehler beim Hochladen: ${message}` },
      { status: 500 }
    )
  }
}
