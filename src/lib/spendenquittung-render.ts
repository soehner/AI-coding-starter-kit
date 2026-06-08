/**
 * PROJ-17: Zentrale Helfer-Funktion, die das PDF einer bereits gespeicherten
 * Spendenquittung **frisch** aus den aktuellen Datenbankwerten rendert.
 *
 * Hintergrund: Das beim Erstellen erzeugte PDF im Storage ist eine
 * Momentaufnahme. Wird ein Spender nachträglich korrigiert (z. B. Adresse
 * nachgetragen), würde das eingefrorene Storage-PDF die alten Daten zeigen.
 * Deshalb generieren Ansicht und E-Mail-Versand das PDF jeweils neu:
 *
 *   - Spenderdaten        → LIVE aus der `spender`-Tabelle (immer aktuell)
 *   - Vereinsdaten        → aus dem `verein_snapshot` (bewusst eingefroren,
 *                           damit historische Quittungen rechtlich stabil
 *                           bleiben, auch wenn die Org-Einstellungen sich ändern)
 *   - Betrag/Daten/Zweck  → aus der Quittungs-Zeile
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { rendereSpendenquittungPdf } from "@/lib/spendenquittung-pdf"
import type { VereinSnapshot } from "@/lib/types"

export type AktuellesQuittungPdf =
  | { ok: true; pdfBuffer: Buffer; quittungNummer: string }
  | { ok: false; status: number; error: string }

/**
 * Lädt die Quittung samt aktuellem Spender und rendert das PDF neu.
 * Gibt bei Fehlern einen passenden HTTP-Status und eine Meldung zurück,
 * damit der aufrufende Endpunkt direkt antworten kann.
 */
export async function rendereAktuelleSpendenquittungPdf(
  supabase: SupabaseClient,
  id: string
): Promise<AktuellesQuittungPdf> {
  const { data: quittung, error } = await supabase
    .from("spendenquittungen")
    .select(
      `
      quittung_nummer,
      betrag,
      spende_datum,
      quittung_datum,
      zweck,
      verein_snapshot,
      spender:spender_id (name, strasse, plz, ort)
      `
    )
    .eq("id", id)
    .single()

  if (error || !quittung) {
    return { ok: false, status: 404, error: "Quittung nicht gefunden." }
  }

  // PostgREST liefert die eingebettete Relation je nach Typ-Inferenz als
  // Objekt oder als Array – beide Fälle abfangen.
  const spender = Array.isArray(quittung.spender)
    ? quittung.spender[0]
    : quittung.spender

  if (!spender) {
    return {
      ok: false,
      status: 500,
      error: "Spenderdaten zur Quittung konnten nicht geladen werden.",
    }
  }

  try {
    const pdfBuffer = await rendereSpendenquittungPdf({
      quittungNummer: quittung.quittung_nummer,
      spendeDatum: quittung.spende_datum,
      quittungDatum: quittung.quittung_datum,
      betrag: Number(quittung.betrag),
      zweck: quittung.zweck,
      spender: {
        name: spender.name,
        strasse: spender.strasse,
        plz: spender.plz,
        ort: spender.ort,
      },
      verein: quittung.verein_snapshot as VereinSnapshot,
    })

    return { ok: true, pdfBuffer, quittungNummer: quittung.quittung_nummer }
  } catch (err) {
    console.error("PDF-Generierung (frisch) fehlgeschlagen:", err)
    return {
      ok: false,
      status: 500,
      error: "PDF konnte nicht erzeugt werden.",
    }
  }
}
