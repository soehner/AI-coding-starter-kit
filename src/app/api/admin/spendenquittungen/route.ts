import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import {
  spendenquittungCreateSchema,
  spendenquittungListQuerySchema,
} from "@/lib/validations/spendenquittung"
import {
  loadOrganisationSettings,
  findFehlendeOrganisationsfelder,
} from "@/lib/organisation-settings"
import { rendereSpendenquittungPdf } from "@/lib/spendenquittung-pdf"
import { defaultEmailVorlage } from "@/lib/spendenquittung-email"
import type { VereinSnapshot } from "@/lib/types"

const PAGE_SIZE = 50
const PDF_BUCKET = "spendenquittungen"

/**
 * GET /api/admin/spendenquittungen
 * Listet alle Spendenquittungen mit Filterung und Paginierung.
 * Lesezugriff: Admin + Betrachter (Viewer) – RLS regelt das.
 *
 * Query-Parameter:
 *   jahr             vierstelliges Jahr (filtert auf spende_datum)
 *   spender_suche    Volltext-Filter auf Spendername
 *   versand_status   "alle" | "versendet" | "nicht_versendet"
 *   page             Seitenzahl (1-basiert)
 */
export async function GET(request: NextRequest) {
  // Hier verwenden wir bewusst NICHT requireAdmin, weil Betrachter
  // die Historie lesen dürfen (RLS lässt SELECT für eingeloggte zu).
  // Stattdessen prüfen wir die Auth manuell.
  const { createServerSupabaseClient } = await import("@/lib/supabase-server")
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

  const { searchParams } = new URL(request.url)
  const validation = spendenquittungListQuerySchema.safeParse({
    jahr: searchParams.get("jahr") || undefined,
    spender_suche: searchParams.get("spender_suche") || undefined,
    versand_status: searchParams.get("versand_status") || undefined,
    page: searchParams.get("page") || undefined,
    transaction_id: searchParams.get("transaction_id") || undefined,
  })

  if (!validation.success) {
    return NextResponse.json(
      {
        error:
          validation.error.issues[0]?.message ?? "Ungültige Parameter.",
      },
      { status: 400 }
    )
  }

  const { jahr, spender_suche, versand_status, transaction_id } =
    validation.data
  const page = Math.max(1, parseInt(validation.data.page || "1", 10))

  let query = supabase
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
      `,
      { count: "exact" }
    )

  if (jahr) {
    query = query
      .gte("spende_datum", `${jahr}-01-01`)
      .lte("spende_datum", `${jahr}-12-31`)
  }

  // BUG-2-Fix: Filter auf einzelne Buchung (für Doppel-Quittungs-Prüfung im Dialog).
  if (transaction_id) {
    query = query.eq("transaction_id", transaction_id)
  }

  if (spender_suche && spender_suche.trim().length > 0) {
    // Wir filtern via FK-Embedded-Tabelle: PostgREST erlaubt das über
    // den embedded resource. Sicherer ist ein Vor-Lookup auf spender.
    const sanitized = spender_suche.trim().replace(/[%_]/g, "\\$&")
    const { data: matchedSpender } = await supabase
      .from("spender")
      .select("id")
      .ilike("name", `%${sanitized}%`)
      .limit(500)

    const spenderIds = (matchedSpender ?? []).map((s) => s.id)
    if (spenderIds.length === 0) {
      return NextResponse.json({
        spendenquittungen: [],
        total: 0,
        page,
        pageSize: PAGE_SIZE,
        totalPages: 0,
      })
    }
    query = query.in("spender_id", spenderIds)
  }

  if (versand_status === "versendet") {
    query = query.not("email_versendet_am", "is", null)
  } else if (versand_status === "nicht_versendet") {
    query = query.is("email_versendet_am", null)
  }

  query = query
    .order("quittung_datum", { ascending: false })
    .order("created_at", { ascending: false })

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) {
    console.error("Fehler beim Laden der Spendenquittungen:", error.message)
    return NextResponse.json(
      { error: "Spendenquittungen konnten nicht geladen werden." },
      { status: 500 }
    )
  }

  return NextResponse.json({
    spendenquittungen: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  })
}

/**
 * POST /api/admin/spendenquittungen
 * Erstellt eine neue Spendenquittung:
 *   1. Organisationsdaten validieren (Pflichtfelder vollständig?)
 *   2. Spender anlegen oder bestehenden verwenden
 *   3. Quittungs-Nummer per RPC vergeben (race-condition-sicher)
 *   4. PDF rendern und in Storage speichern
 *   5. DB-Zeile schreiben
 *
 * Kein automatischer E-Mail-Versand – der erfolgt separat über
 * /api/admin/spendenquittungen/[id]/email.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 }
    )
  }

  const validation = spendenquittungCreateSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      {
        error: validation.error.issues[0]?.message ?? "Ungültige Eingabe.",
      },
      { status: 400 }
    )
  }

  const data = validation.data
  const supabase = createAdminSupabaseClient()

  // 1. Organisationseinstellungen prüfen
  const org = await loadOrganisationSettings(supabase)
  const fehlend = findFehlendeOrganisationsfelder(org)
  if (fehlend.length > 0) {
    return NextResponse.json(
      {
        error:
          "Vor dem Erstellen einer Spendenquittung müssen die Organisationseinstellungen vollständig ausgefüllt sein.",
        fehlende_felder: fehlend,
      },
      { status: 400 }
    )
  }

  // 2. Spender ermitteln oder anlegen
  let spenderId: string
  let spenderName: string
  let spenderStrasse: string | null = null
  let spenderPlz: string | null = null
  let spenderOrt: string | null = null

  if (data.spender_id) {
    const { data: existing, error: spenderError } = await supabase
      .from("spender")
      .select("id, name, strasse, plz, ort")
      .eq("id", data.spender_id)
      .single()

    if (spenderError || !existing) {
      return NextResponse.json(
        { error: "Spender nicht gefunden." },
        { status: 404 }
      )
    }
    spenderId = existing.id
    spenderName = existing.name
    spenderStrasse = existing.strasse
    spenderPlz = existing.plz
    spenderOrt = existing.ort
  } else if (data.spender_neu) {
    const neu = data.spender_neu
    const { data: inserted, error: insertError } = await supabase
      .from("spender")
      .insert({
        name: neu.name,
        strasse: neu.strasse || null,
        plz: neu.plz || null,
        ort: neu.ort || null,
        email: neu.email || null,
        iban: neu.iban || null,
      })
      .select("id, name, strasse, plz, ort")
      .single()

    if (insertError || !inserted) {
      console.error("Spender-Insert fehlgeschlagen:", insertError?.message)
      return NextResponse.json(
        { error: "Spender konnte nicht angelegt werden." },
        { status: 500 }
      )
    }
    spenderId = inserted.id
    spenderName = inserted.name
    spenderStrasse = inserted.strasse
    spenderPlz = inserted.plz
    spenderOrt = inserted.ort
  } else {
    // Schema verhindert das eigentlich; doppelte Absicherung.
    return NextResponse.json(
      { error: "Spender-Angabe fehlt." },
      { status: 400 }
    )
  }

  // 3. Quittungs-Nummer vergeben (race-condition-sicher via RPC + UNIQUE-Constraint)
  const { data: quittungNummer, error: nummerError } = await supabase.rpc(
    "next_spendenquittung_nummer"
  )

  if (nummerError || !quittungNummer || typeof quittungNummer !== "string") {
    console.error("Quittungs-Nummer konnte nicht erzeugt werden:", nummerError)
    return NextResponse.json(
      { error: "Quittungs-Nummer konnte nicht erzeugt werden." },
      { status: 500 }
    )
  }

  // Defensiv: RPC-Output gegen Format-Spec validieren (CHECK-Constraint in DB
  // greift erst beim INSERT; Pfad würde aber vorher in Storage geschrieben).
  if (!/^SQ-\d{4}-\d{4,}$/.test(quittungNummer)) {
    console.error(
      "Quittungs-Nummer aus RPC entspricht nicht dem erwarteten Format:",
      quittungNummer
    )
    return NextResponse.json(
      { error: "Quittungs-Nummer hat ein ungültiges Format." },
      { status: 500 }
    )
  }

  // Ausstellungsdatum: vom Client übergeben oder heute
  const quittungDatum =
    data.quittung_datum || new Date().toISOString().split("T")[0]

  // Snapshot der Vereinsdaten (in JSONB persistieren)
  // Vorstandsdaten gehören NICHT in den Snapshot – sie sind nicht Teil
  // des amtlichen Musters und ändern sich unabhängig von der Quittung.
  const vereinSnapshot: VereinSnapshot = {
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

  // 4. PDF rendern
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await rendereSpendenquittungPdf({
      quittungNummer,
      spendeDatum: data.spende_datum,
      quittungDatum,
      betrag: data.betrag,
      zweck: data.zweck,
      spender: {
        name: spenderName,
        strasse: spenderStrasse,
        plz: spenderPlz,
        ort: spenderOrt,
      },
      verein: vereinSnapshot,
    })
  } catch (err) {
    console.error("PDF-Generierung fehlgeschlagen:", err)
    return NextResponse.json(
      { error: "PDF konnte nicht erzeugt werden." },
      { status: 500 }
    )
  }

  // 5. PDF in Storage hochladen
  const jahr = data.spende_datum.split("-")[0]
  const pdfPfad = `${jahr}/${quittungNummer}.pdf`
  const { error: uploadError } = await supabase.storage
    .from(PDF_BUCKET)
    .upload(pdfPfad, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    })

  if (uploadError) {
    console.error("PDF-Upload fehlgeschlagen:", uploadError.message)
    return NextResponse.json(
      { error: "PDF konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }

  // 6. DB-Zeile schreiben
  const { data: inserted, error: insertError } = await supabase
    .from("spendenquittungen")
    .insert({
      quittung_nummer: quittungNummer,
      transaction_id: data.transaction_id ?? null,
      spender_id: spenderId,
      betrag: data.betrag,
      spende_datum: data.spende_datum,
      quittung_datum: quittungDatum,
      zweck: data.zweck,
      verein_snapshot: vereinSnapshot,
      pdf_path: pdfPfad,
      erstellt_von: auth.profile.id,
    })
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
    .single()

  if (insertError || !inserted) {
    console.error("Quittungs-Insert fehlgeschlagen:", insertError?.message)
    // Aufräumen: PDF aus Storage entfernen, sonst Datenleichen
    await supabase.storage.from(PDF_BUCKET).remove([pdfPfad])
    return NextResponse.json(
      { error: "Quittung konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }

  // E-Mail-Vorlage als Hilfestellung für den Frontend-Dialog
  const emailVorlage = defaultEmailVorlage({
    spenderName,
    vereinName: org.verein_name,
    quittungNummer,
    betrag: data.betrag,
    spendeDatum: data.spende_datum,
  })

  return NextResponse.json(
    { spendenquittung: inserted, email_vorlage: emailVorlage },
    { status: 201 }
  )
}
