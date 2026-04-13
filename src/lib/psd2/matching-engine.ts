import type { SupabaseClient } from "@supabase/supabase-js"
import { berechneMatchingHash, euroZuCent } from "./matching-hash"

/**
 * PROJ-16: Zweistufige Matching-Engine zum Abgleich von PDF- und PSD2-Daten.
 *
 * Die Engine arbeitet gegen die Tabelle `transactions` (real existierend,
 * in der Feature-Spec als "bank_umsaetze" bezeichnet).
 *
 * Ablauf fuer einen PDF-Import-Eintrag:
 *   1. exakter Hash-Match → bestaetigt (quelle='beide')
 *   2. Fuzzy-Match (Datum +/- 1 Tag, Betrag exakt, IBAN exakt):
 *      - Beitrag gleich, Hash unterschiedlich → vorschlag
 *      - Betrag unterschiedlich → konflikt
 *   3. Kein Match → neuer PDF-Eintrag
 *
 * Der Aufrufer entscheidet, ob er die Aktion direkt ausfuehrt (z.B. im
 * Import-Confirm-Endpoint) oder sie nur als Vorschlag an das UI meldet.
 */

export type AbgleichAktion =
  | "bestaetigt"
  | "vorschlag"
  | "konflikt"
  | "neu"

export interface AbgleichKandidat {
  id: string
  booking_date: string
  amount: number
  iban_gegenseite: string | null
  matching_hash: string | null
  status: string
  quelle: string
  nicht_matchen_mit: string[] | null
}

export interface AbgleichErgebnis {
  aktion: AbgleichAktion
  hash: string
  /** Gefundener existierender Eintrag (nur bei bestaetigt/vorschlag/konflikt). */
  kandidat?: AbgleichKandidat
  /** Bei Konflikt: Felder, die sich unterscheiden. */
  konflikt_felder?: string[]
}

export interface PdfEintrag {
  booking_date: string
  value_date: string
  description: string
  counterpart?: string | null
  amount: number
  balance_after: number
  iban_gegenseite?: string | null
}

/**
 * Fuehrt das Matching fuer einen einzelnen PDF-Eintrag durch.
 * Der Aufrufer muss den Supabase-Admin-Client bereitstellen (Service-Role),
 * damit RLS nicht im Weg steht.
 */
export async function pruefeAbgleich(
  client: SupabaseClient,
  pdf: PdfEintrag
): Promise<AbgleichErgebnis> {
  const hash = berechneMatchingHash({
    buchungsdatum: pdf.booking_date,
    betrag_cent: euroZuCent(pdf.amount),
    iban_gegenseite: pdf.iban_gegenseite ?? null,
    verwendungszweck: pdf.description,
  })

  // 1) Exakter Hash-Match
  const { data: hashTreffer } = await client
    .from("transactions")
    .select(
      "id, booking_date, amount, iban_gegenseite, matching_hash, status, quelle, nicht_matchen_mit"
    )
    .eq("matching_hash", hash)
    .limit(1)
    .maybeSingle()

  if (hashTreffer) {
    return {
      aktion: "bestaetigt",
      hash,
      kandidat: hashTreffer as AbgleichKandidat,
    }
  }

  // 2) Fuzzy-Match: Datum +/- 1 Tag, IBAN exakt
  const fuzzyVorherDatum = tagDelta(pdf.booking_date, -1)
  const fuzzyNachherDatum = tagDelta(pdf.booking_date, 1)

  let fuzzyQuery = client
    .from("transactions")
    .select(
      "id, booking_date, amount, iban_gegenseite, matching_hash, status, quelle, nicht_matchen_mit"
    )
    .gte("booking_date", fuzzyVorherDatum)
    .lte("booking_date", fuzzyNachherDatum)

  if (pdf.iban_gegenseite) {
    fuzzyQuery = fuzzyQuery.eq("iban_gegenseite", pdf.iban_gegenseite)
  } else {
    fuzzyQuery = fuzzyQuery.is("iban_gegenseite", null)
  }

  const { data: fuzzyKandidaten } = await fuzzyQuery.limit(10)

  if (fuzzyKandidaten && fuzzyKandidaten.length > 0) {
    const pdfCent = euroZuCent(pdf.amount)
    for (const k of fuzzyKandidaten as AbgleichKandidat[]) {
      // Blockliste pruefen: Paare, die der Kassenwart explizit getrennt hat.
      if ((k.nicht_matchen_mit ?? []).length > 0) {
        // Wir koennen hier keine PDF-ID kennen (der PDF-Eintrag existiert
        // noch nicht). Stattdessen blockiert diese Liste nur Kandidaten,
        // bei denen irgendeine ID eingetragen ist → wir ueberspringen sie.
        continue
      }
      const kCent = euroZuCent(Number(k.amount))
      if (kCent === pdfCent) {
        // Betrag exakt: Vorschlag (Hash war bereits unterschiedlich)
        return {
          aktion: "vorschlag",
          hash,
          kandidat: k,
        }
      } else {
        // Betrag abweichend: Konflikt
        return {
          aktion: "konflikt",
          hash,
          kandidat: k,
          konflikt_felder: ["amount"],
        }
      }
    }
  }

  return { aktion: "neu", hash }
}

/**
 * Addiert Tage zu einem ISO-Datum (YYYY-MM-DD) und gibt das Ergebnis als
 * ISO-Datum zurueck. UTC-basiert, um Zeitzonen-Verschiebungen zu vermeiden.
 */
function tagDelta(iso: string, tage: number): string {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10))
  const datum = new Date(Date.UTC(y, m - 1, d))
  datum.setUTCDate(datum.getUTCDate() + tage)
  const yy = datum.getUTCFullYear().toString().padStart(4, "0")
  const mm = (datum.getUTCMonth() + 1).toString().padStart(2, "0")
  const dd = datum.getUTCDate().toString().padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}
