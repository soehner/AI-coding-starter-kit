import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/admin-auth"
import { spendenquittungUpdateSchema } from "@/lib/validations/spendenquittung"
import { loadOrganisationSettings } from "@/lib/organisation-settings"
import { rendereSpendenquittungPdf } from "@/lib/spendenquittung-pdf"
import type { VereinSnapshot } from "@/lib/types"

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SIGNED_URL_TTL_SECONDS = 5 * 60 // 5 Minuten – Download soll zeitnah erfolgen
const PDF_BUCKET = "spendenquittungen"

/**
 * GET /api/admin/spendenquittungen/[id]
 * Liefert die Detaildaten einer einzelnen Quittung inklusive
 * einer kurzlebigen, signierten Download-URL für das PDF.
 *
 * Zugriff: Admin + Betrachter (Lesezugriff erlaubt – das PDF ist
 * Bestandteil der Vereinsdokumentation).
 */
export async function GET(
  _request: NextRequest,
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

  // Daten via authentifizierte Session (RLS regelt Sichtbarkeit)
  const { data: quittung, error } = await supabase
    .from("spendenquittungen")
    .select(
      `
      id,
      quittung_nummer,
      transaction_id,
      spender_id,
      betrag,
      spende_datum,
      quittung_datum,
      zweck,
      verein_snapshot,
      pdf_path,
      email_versendet_am,
      email_empfaenger,
      erstellt_von,
      created_at,
      spender:spender_id (id, name, strasse, plz, ort, email, iban)
      `
    )
    .eq("id", id)
    .single()

  if (error || !quittung) {
    return NextResponse.json(
      { error: "Quittung nicht gefunden." },
      { status: 404 }
    )
  }

  // Signierte URL für PDF-Download (privater Bucket → Admin-Client nötig)
  const adminClient = createAdminSupabaseClient()
  const { data: signed, error: signError } = await adminClient.storage
    .from(PDF_BUCKET)
    .createSignedUrl(quittung.pdf_path, SIGNED_URL_TTL_SECONDS)

  if (signError || !signed) {
    console.error(
      "Signierte URL konnte nicht erzeugt werden:",
      signError?.message
    )
    return NextResponse.json(
      { error: "PDF-Download-Link konnte nicht erzeugt werden." },
      { status: 500 }
    )
  }

  return NextResponse.json({
    spendenquittung: quittung,
    pdf_url: signed.signedUrl,
    pdf_url_gueltig_bis_sek: SIGNED_URL_TTL_SECONDS,
  })
}

/**
 * PATCH /api/admin/spendenquittungen/[id]
 *
 * Aktualisiert eine bestehende Quittung. Inhaltsänderungen (Betrag, Datum,
 * Zweck, Spender) erzwingen eine Neugenerierung des PDFs:
 *   1. Geändertes PDF rendern (mit dem ursprünglichen verein_snapshot –
 *      historische Vereinsdaten bleiben erhalten, damit die Quittung
 *      auch nach späteren Settings-Änderungen rechtskonform bleibt).
 *   2. Neue PDF-Datei in Storage hochladen (gleicher Pfad, upsert).
 *   3. DB-Zeile aktualisieren.
 *
 * Zugriff: Nur Administratoren.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { id } = await params
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { error: "Ungültige Quittungs-ID." },
      { status: 400 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 }
    )
  }

  const validation = spendenquittungUpdateSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      {
        error: validation.error.issues[0]?.message ?? "Ungültige Eingabe.",
      },
      { status: 400 }
    )
  }

  const supabase = createAdminSupabaseClient()

  // Aktuelle Quittung laden (für PDF-Pfad + Snapshot + fallback Werte)
  const { data: existing, error: loadError } = await supabase
    .from("spendenquittungen")
    .select(
      `
      id,
      quittung_nummer,
      transaction_id,
      spender_id,
      betrag,
      spende_datum,
      quittung_datum,
      zweck,
      verein_snapshot,
      pdf_path,
      email_versendet_am,
      email_empfaenger,
      erstellt_von,
      created_at
      `
    )
    .eq("id", id)
    .single()

  if (loadError || !existing) {
    return NextResponse.json(
      { error: "Quittung nicht gefunden." },
      { status: 404 }
    )
  }

  const update = validation.data

  // Neue Spenderdaten laden, falls Spender getauscht wird
  let spender_id = existing.spender_id
  let spenderName: string
  let spenderStrasse: string | null
  let spenderPlz: string | null
  let spenderOrt: string | null

  if (update.spender_id && update.spender_id !== existing.spender_id) {
    const { data: neuerSpender, error: spenderError } = await supabase
      .from("spender")
      .select("id, name, strasse, plz, ort")
      .eq("id", update.spender_id)
      .single()

    if (spenderError || !neuerSpender) {
      return NextResponse.json(
        { error: "Spender nicht gefunden." },
        { status: 404 }
      )
    }
    spender_id = neuerSpender.id
    spenderName = neuerSpender.name
    spenderStrasse = neuerSpender.strasse
    spenderPlz = neuerSpender.plz
    spenderOrt = neuerSpender.ort
  } else {
    // Bestehenden Spender erneut laden (für PDF-Rendering)
    const { data: spender, error: spenderError } = await supabase
      .from("spender")
      .select("name, strasse, plz, ort")
      .eq("id", existing.spender_id)
      .single()

    if (spenderError || !spender) {
      return NextResponse.json(
        { error: "Spender der Quittung nicht auffindbar." },
        { status: 500 }
      )
    }
    spenderName = spender.name
    spenderStrasse = spender.strasse
    spenderPlz = spender.plz
    spenderOrt = spender.ort
  }

  // Effektive Werte für PDF-Rendering ermitteln
  const neueBetrag = update.betrag ?? Number(existing.betrag)
  const neuesSpendeDatum = update.spende_datum ?? existing.spende_datum
  const neuesQuittungDatum = update.quittung_datum ?? existing.quittung_datum
  const neuerZweck = update.zweck ?? existing.zweck

  // Der ursprüngliche verein_snapshot bleibt erhalten – Quittungen sind
  // unveränderliche Dokumente bzgl. der Vereinsdaten zum Ausstellungszeitpunkt.
  // Falls der Snapshot wider Erwarten fehlt (Altdatensatz), aus Settings nachladen.
  let vereinSnapshot: VereinSnapshot = existing.verein_snapshot
  if (!vereinSnapshot || !vereinSnapshot.verein_name) {
    const org = await loadOrganisationSettings(supabase)
    vereinSnapshot = {
      verein_name: org.verein_name,
      adresse_zeile1: org.adresse_zeile1,
      adresse_zeile2: org.adresse_zeile2,
      plz: org.plz,
      ort: org.ort,
      steuernummer: org.steuernummer,
      finanzamt: org.finanzamt,
      freistellungsbescheid_datum: org.freistellungsbescheid_datum,
      freistellungsbescheid_aktenzeichen: org.freistellungsbescheid_aktenzeichen,
      satzungszweck: org.satzungszweck,
      unterzeichner_name: org.unterzeichner_name,
      letzter_veranlagungszeitraum: org.letzter_veranlagungszeitraum,
    }
  }

  // PDF neu rendern
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await rendereSpendenquittungPdf({
      quittungNummer: existing.quittung_nummer,
      spendeDatum: neuesSpendeDatum,
      quittungDatum: neuesQuittungDatum,
      betrag: neueBetrag,
      zweck: neuerZweck,
      spender: {
        name: spenderName,
        strasse: spenderStrasse,
        plz: spenderPlz,
        ort: spenderOrt,
      },
      verein: vereinSnapshot,
    })
  } catch (err) {
    console.error("PDF-Neugenerierung fehlgeschlagen:", err)
    return NextResponse.json(
      { error: "PDF konnte nicht neu erzeugt werden." },
      { status: 500 }
    )
  }

  // PDF in Storage ersetzen (upsert)
  const { error: uploadError } = await supabase.storage
    .from(PDF_BUCKET)
    .upload(existing.pdf_path, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    })

  if (uploadError) {
    console.error("PDF-Replace fehlgeschlagen:", uploadError.message)
    return NextResponse.json(
      { error: "PDF konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }

  // DB aktualisieren – nur tatsächlich geänderte Felder schreiben
  const updateFields: Record<string, unknown> = {}
  if (update.betrag !== undefined) updateFields.betrag = update.betrag
  if (update.spende_datum !== undefined)
    updateFields.spende_datum = update.spende_datum
  if (update.quittung_datum !== undefined)
    updateFields.quittung_datum = update.quittung_datum
  if (update.zweck !== undefined) updateFields.zweck = update.zweck
  if (update.spender_id !== undefined) updateFields.spender_id = spender_id

  const { data: updated, error: updateError } = await supabase
    .from("spendenquittungen")
    .update(updateFields)
    .eq("id", id)
    .select(
      `
      id,
      quittung_nummer,
      transaction_id,
      spender_id,
      betrag,
      spende_datum,
      quittung_datum,
      zweck,
      verein_snapshot,
      pdf_path,
      email_versendet_am,
      email_empfaenger,
      erstellt_von,
      created_at,
      spender:spender_id (id, name, email)
      `
    )
    .single()

  if (updateError || !updated) {
    console.error("Quittungs-Update fehlgeschlagen:", updateError?.message)
    return NextResponse.json(
      { error: "Quittung konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }

  return NextResponse.json({ spendenquittung: updated })
}

/**
 * DELETE /api/admin/spendenquittungen/[id]
 *
 * Löscht eine Quittung samt PDF aus dem Storage.
 *
 * Wichtig: Steuerlich werden Quittungen normalerweise nicht gelöscht.
 * Diese Funktion dient ausschließlich Korrekturen vor Aushändigung oder
 * Stornierungen. Bereits per E-Mail versendete Quittungen können trotzdem
 * gelöscht werden; eine Warnung erscheint im Frontend.
 *
 * Zugriff: Nur Administratoren.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { id } = await params
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { error: "Ungültige Quittungs-ID." },
      { status: 400 }
    )
  }

  const supabase = createAdminSupabaseClient()

  // PDF-Pfad ermitteln, um die Datei aus Storage zu entfernen
  const { data: quittung, error: loadError } = await supabase
    .from("spendenquittungen")
    .select("id, pdf_path, quittung_nummer")
    .eq("id", id)
    .single()

  if (loadError || !quittung) {
    return NextResponse.json(
      { error: "Quittung nicht gefunden." },
      { status: 404 }
    )
  }

  // DB-Zeile zuerst löschen (bei Fehler bleibt das PDF erhalten → keine Datenleichen)
  const { error: deleteError } = await supabase
    .from("spendenquittungen")
    .delete()
    .eq("id", id)

  if (deleteError) {
    console.error("Quittungs-Löschen fehlgeschlagen:", deleteError.message)
    return NextResponse.json(
      { error: "Quittung konnte nicht gelöscht werden." },
      { status: 500 }
    )
  }

  // PDF aus Storage entfernen (Fehler nicht fatal – Datenintegrität in DB ist gewahrt)
  const { error: storageError } = await supabase.storage
    .from(PDF_BUCKET)
    .remove([quittung.pdf_path])

  if (storageError) {
    console.warn(
      `PDF konnte nicht aus Storage entfernt werden (${quittung.pdf_path}):`,
      storageError.message
    )
  }

  return NextResponse.json({
    success: true,
    quittung_nummer: quittung.quittung_nummer,
  })
}
