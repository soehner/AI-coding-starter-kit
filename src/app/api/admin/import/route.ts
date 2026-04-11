import { NextResponse } from "next/server"
import { requirePermission } from "@/lib/require-permission"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { decrypt } from "@/lib/encryption"
import { parseBankStatement } from "@/lib/ki-parser"
import type { KiProvider } from "@/lib/types"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB serverseitiges Limit

/**
 * POST /api/admin/import
 * Nimmt ein PDF entgegen, lädt es in Supabase Storage hoch,
 * parst es mit der konfigurierten KI-API und gibt die erkannten Buchungen zurück.
 */
export async function POST(request: Request) {
  // Auth + Berechtigung (import_statements) prüfen
  const authResult = await requirePermission("import_statements")
  if (authResult.error) {
    return authResult.error
  }

  // 1. FormData lesen
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

  // 2. Datei validieren
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Nur PDF-Dateien sind erlaubt." },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        error: `Datei zu gross. Maximale Groesse: ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
      },
      { status: 400 }
    )
  }

  // 3. KI-Einstellungen laden
  const adminClient = createAdminSupabaseClient()

  const { data: settings } = await adminClient
    .from("app_settings")
    .select("key, value")
    .in("key", ["ki_provider", "ki_token"])
    .limit(2)

  const providerSetting = settings?.find((s) => s.key === "ki_provider")
  const tokenSetting = settings?.find((s) => s.key === "ki_token")

  if (!tokenSetting?.value) {
    return NextResponse.json(
      {
        error:
          "Kein API-Token konfiguriert. Bitte in den Einstellungen hinterlegen.",
      },
      { status: 400 }
    )
  }

  let apiToken: string
  try {
    apiToken = decrypt(tokenSetting.value)
  } catch {
    return NextResponse.json(
      { error: "API-Token konnte nicht entschlüsselt werden." },
      { status: 500 }
    )
  }

  const provider = (providerSetting?.value || "openai") as KiProvider

  // 4. PDF lesen
  const arrayBuffer = await file.arrayBuffer()
  const pdfBuffer = Buffer.from(arrayBuffer)

  // 5. PDF in Supabase Storage hochladen
  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const storagePath = `statements/${timestamp}_${sanitizedName}`

  const { error: uploadError } = await adminClient.storage
    .from("bank-statements")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    })

  if (uploadError) {
    console.error("Storage-Upload-Fehler:", uploadError.message)
    return NextResponse.json(
      { error: "PDF konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }

  // 6. Seitenanzahl prüfen (Warnung bei grossen PDFs)
  const MAX_PAGES = 50
  let pageCount = 0
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise
    pageCount = doc.numPages
    doc.destroy()
  } catch {
    // Seitenanzahl-Check ist nicht kritisch - weiter mit Parsing
  }

  if (pageCount > MAX_PAGES) {
    return NextResponse.json(
      {
        error: `PDF hat ${pageCount} Seiten (maximal ${MAX_PAGES} erlaubt). Bitte einzelne Kontoauszüge hochladen.`,
      },
      { status: 400 }
    )
  }

  // 7. PDF mit KI parsen
  let result
  try {
    result = await parseBankStatement(pdfBuffer, provider, apiToken)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "PDF-Parsing fehlgeschlagen."
    console.error("KI-Parser-Fehler:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // 8. Duplikat-Erkennung (gezielt nur relevante Buchungsdaten abfragen)
  const bookingDates = result.transactions.map((tx) => tx.booking_date)
  const uniqueDates = [...new Set(bookingDates)]

  const { data: existingTransactions } = await adminClient
    .from("transactions")
    .select("booking_date, amount, description")
    .in("booking_date", uniqueDates)

  if (existingTransactions && existingTransactions.length > 0) {
    const existingSet = new Set(
      existingTransactions.map(
        (t) => `${t.booking_date}|${t.amount}|${t.description}`
      )
    )

    result.transactions = result.transactions.map((tx) => ({
      ...tx,
      isDuplicate: existingSet.has(
        `${tx.booking_date}|${tx.amount}|${tx.description}`
      ),
    }))
  }

  // 8. Datei-Informationen zur Antwort hinzufuegen
  return NextResponse.json({
    ...result,
    file_name: file.name,
    file_path: storagePath,
  })
}
