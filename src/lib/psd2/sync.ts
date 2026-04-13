import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getTransactions,
  type EbTransaction,
} from "./enablebanking-client"
import { berechneMatchingHash, euroZuCent } from "./matching-hash"
import { sendeConsentRenewalEmail } from "@/lib/psd2-emails"

/**
 * PROJ-16: Zentrale Abruflogik für die BBBank über Enable Banking (PSD2).
 * Wird sowohl vom Cron-Endpunkt als auch vom manuellen Sync-Button verwendet.
 *
 * Ablauf:
 *  1. Verbindung prüfen (Tabelle psd2_verbindungen)
 *  2. Consent-Ablauf prüfen; bei <= 7 Tagen Erinnerungs-Mail (dedupliziert)
 *  3. Umsätze seit letztem erfolgreichen Abruf (bzw. -90 Tage beim 1. Mal)
 *  4. INSERT in transactions mit quelle='psd2', status='nur_psd2'
 *  5. Letzter-Abruf-Status aktualisieren
 *
 * Das Matching (Hash + Fuzzy-Fallback) geschieht erst beim PDF-Import und ist
 * von dieser Datei unabhängig — siehe matching-engine.ts.
 */

export interface SyncErgebnis {
  verbunden: boolean
  abrufStatus: "erfolg" | "fehler" | "ausgelassen"
  /** Neu angelegte Umsätze in dieser Sync-Runde. */
  neue: number
  /** Umsätze, die bereits existierten (Hash schon vorhanden) oder unvollständig waren. */
  aktualisiert: number
  /** Anzahl einzelner Fehler (keine Abbrüche) — z. B. Parser-Probleme einzelner Umsätze. */
  fehler: number
  /** Fehlermeldung auf Toplevel (bei vollständigem Fehlschlag). */
  fehlerMeldung?: string
  consentTageVerbleibend?: number
  consentMailGesendet?: boolean
}

export async function fuehreBankAbrufAus(
  client: SupabaseClient
): Promise<SyncErgebnis> {
  const { data: verbindung, error: verbError } = await client
    .from("psd2_verbindungen")
    .select("*")
    .order("erstellt_am", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (verbError) {
    return {
      verbunden: false,
      abrufStatus: "fehler",
      neue: 0,
      aktualisiert: 0,
      fehler: 0,
      fehlerMeldung: `Fehler beim Lesen der PSD2-Verbindung: ${verbError.message}`,
    }
  }

  if (!verbindung || !verbindung.enablebanking_account_id) {
    return {
      verbunden: false,
      abrufStatus: "ausgelassen",
      neue: 0,
      aktualisiert: 0,
      fehler: 0,
    }
  }

  // Consent-Ablauf prüfen
  let consentTageVerbleibend: number | undefined
  let consentMailGesendet = false
  if (verbindung.consent_gueltig_bis) {
    const heute = new Date()
    heute.setUTCHours(0, 0, 0, 0)
    const ablauf = new Date(verbindung.consent_gueltig_bis + "T00:00:00Z")
    consentTageVerbleibend = Math.floor(
      (ablauf.getTime() - heute.getTime()) / (24 * 60 * 60 * 1000)
    )

    if (consentTageVerbleibend < 0) {
      // Abgelaufen: Abruf pausieren, keine Fehler-Mail
      return {
        verbunden: true,
        abrufStatus: "ausgelassen",
        neue: 0,
        aktualisiert: 0,
        fehler: 0,
        consentTageVerbleibend,
        fehlerMeldung: "Zustimmung abgelaufen. Bitte Bankzugang erneuern.",
      }
    }

    if (consentTageVerbleibend <= 7) {
      consentMailGesendet = await versendeRenewalMailWennFaellig(
        client,
        verbindung,
        consentTageVerbleibend
      )
    }
  }

  // Zeitraum für den Abruf bestimmen
  const heute = new Date()
  const dateTo = heute.toISOString().slice(0, 10)
  let dateFrom: string
  if (verbindung.letzter_abruf_am) {
    // Einige Tage zurück, um verspätete Buchungen mitzunehmen
    const d = new Date(verbindung.letzter_abruf_am)
    d.setUTCDate(d.getUTCDate() - 3)
    dateFrom = d.toISOString().slice(0, 10)
  } else {
    // Initial: 90 Tage zurück (PSD2-Historie-Limit bei vielen Banken)
    const d = new Date(heute)
    d.setUTCDate(d.getUTCDate() - 90)
    dateFrom = d.toISOString().slice(0, 10)
  }

  let ebTransaktionen: EbTransaction[]
  try {
    ebTransaktionen = await getTransactions(
      verbindung.enablebanking_account_id as string,
      dateFrom,
      dateTo
    )
  } catch (err) {
    const meldung =
      err instanceof Error ? err.message : "Unbekannter Fehler beim Abruf."
    await client
      .from("psd2_verbindungen")
      .update({
        letzter_abruf_am: new Date().toISOString(),
        letzter_abruf_status: "fehler",
        letzter_abruf_fehler: meldung,
        aufeinanderfolgende_fehler:
          (verbindung.aufeinanderfolgende_fehler ?? 0) + 1,
      })
      .eq("id", verbindung.id)

    return {
      verbunden: true,
      abrufStatus: "fehler",
      neue: 0,
      aktualisiert: 0,
      fehler: 1,
      fehlerMeldung: meldung,
      consentTageVerbleibend,
      consentMailGesendet,
    }
  }

  let neue = 0
  let aktualisiert = 0
  let fehler = 0

  for (const tx of ebTransaktionen) {
    const umgewandelt = wandleEbTransaktionUm(tx)
    if (!umgewandelt) {
      aktualisiert++ // unvollständig → übersprungen
      continue
    }

    const hash = berechneMatchingHash({
      buchungsdatum: umgewandelt.booking_date,
      betrag_cent: euroZuCent(umgewandelt.amount),
      iban_gegenseite: umgewandelt.iban_gegenseite,
      verwendungszweck: umgewandelt.description,
    })

    // Prüfen, ob Hash schon existiert (verhindert Duplikate)
    const { data: vorhandene } = await client
      .from("transactions")
      .select("id")
      .eq("matching_hash", hash)
      .maybeSingle()

    if (vorhandene) {
      aktualisiert++
      continue
    }

    // Virtuellen Sammel-Kontoauszug je PSD2-Verbindung sicherstellen
    const statementId = await holePsd2SammelStatement(client, verbindung.id)
    if (!statementId) {
      fehler++
      continue
    }

    const { error: insertError } = await client.from("transactions").insert({
      statement_id: statementId,
      booking_date: umgewandelt.booking_date,
      value_date: umgewandelt.value_date,
      description: umgewandelt.description,
      counterpart: umgewandelt.counterpart,
      amount: umgewandelt.amount,
      // balance_after ist bei PSD2-Einzelumsätzen nicht bekannt.
      // Wir lassen ihn bewusst auf 0; der Dashboard-Saldo wird seit
      // Migration 024 über get_current_balance() rekonstruiert.
      balance_after: 0,
      matching_hash: hash,
      quelle: "psd2",
      status: "nur_psd2",
      psd2_abgerufen_am: new Date().toISOString(),
      psd2_original_data: tx as unknown as Record<string, unknown>,
      iban_gegenseite: umgewandelt.iban_gegenseite,
    })

    if (insertError) {
      if (insertError.code === "23505") {
        // Unique-Violation → Hash existiert bereits → zählt als „aktualisiert"
        aktualisiert++
      } else {
        fehler++
        console.error("PSD2-Insert-Fehler:", insertError.message)
      }
      continue
    }
    neue++
  }

  await client
    .from("psd2_verbindungen")
    .update({
      letzter_abruf_am: new Date().toISOString(),
      letzter_abruf_status: "erfolg",
      letzter_abruf_fehler: null,
      aufeinanderfolgende_fehler: 0,
    })
    .eq("id", verbindung.id)

  return {
    verbunden: true,
    abrufStatus: "erfolg",
    neue,
    aktualisiert,
    fehler,
    consentTageVerbleibend,
    consentMailGesendet,
  }
}

interface UmgewandelteTransaktion {
  booking_date: string
  value_date: string
  description: string
  counterpart: string | null
  amount: number
  iban_gegenseite: string | null
}

/**
 * Wandelt eine Enable-Banking-Transaktion in die für CBS-Finanz passende
 * Struktur um. Gibt null zurück, wenn Pflichtfelder fehlen.
 *
 * - `credit_debit_indicator` bestimmt das Vorzeichen:
 *    CRDT = Geldeingang (positiv), DBIT = Geldausgang (negativ).
 * - Gegenseite-IBAN: bei CRDT der `debtor_account.iban`, bei DBIT der
 *    `creditor_account.iban`.
 */
function wandleEbTransaktionUm(
  tx: EbTransaction
): UmgewandelteTransaktion | null {
  const buchungsdatum = tx.booking_date ?? tx.value_date ?? tx.transaction_date
  if (!buchungsdatum) return null
  if (!tx.transaction_amount?.amount) return null

  const betragAbs = Number(tx.transaction_amount.amount)
  if (Number.isNaN(betragAbs)) return null

  const istEinzahlung = tx.credit_debit_indicator === "CRDT"
  const amount = istEinzahlung ? Math.abs(betragAbs) : -Math.abs(betragAbs)

  const beschreibung = (Array.isArray(tx.remittance_information)
    ? tx.remittance_information.filter(Boolean).join(" ")
    : ""
  ).trim()

  const gegenseiteName = istEinzahlung
    ? tx.debtor?.name ?? null
    : tx.creditor?.name ?? null
  const gegenseiteIban = istEinzahlung
    ? tx.debtor_account?.iban ?? null
    : tx.creditor_account?.iban ?? null

  return {
    booking_date: buchungsdatum,
    value_date: tx.value_date ?? buchungsdatum,
    description: beschreibung || "(Kein Verwendungszweck)",
    counterpart: gegenseiteName,
    amount,
    iban_gegenseite: gegenseiteIban,
  }
}

/**
 * Legt bei Bedarf einen virtuellen Sammel-Bank-Statement-Eintrag für
 * diese PSD2-Verbindung an und gibt dessen ID zurück.
 */
async function holePsd2SammelStatement(
  client: SupabaseClient,
  verbindungsId: string
): Promise<string | null> {
  const sammelNummer = `PSD2-${verbindungsId.slice(0, 8)}`

  const { data: existing } = await client
    .from("bank_statements")
    .select("id")
    .eq("statement_number", sammelNummer)
    .maybeSingle()

  if (existing) return existing.id as string

  const { data: verbindung } = await client
    .from("psd2_verbindungen")
    .select("erstellt_von")
    .eq("id", verbindungsId)
    .single()

  if (!verbindung) return null

  const { data: neu, error } = await client
    .from("bank_statements")
    .insert({
      file_name: `psd2-sammel-${verbindungsId.slice(0, 8)}.virtual`,
      statement_date: new Date().toISOString().slice(0, 10),
      statement_number: sammelNummer,
      transaction_count: 0,
      start_balance: 0,
      end_balance: 0,
      file_path: "virtual/psd2",
      uploaded_by: verbindung.erstellt_von,
    })
    .select("id")
    .single()

  if (error || !neu) {
    console.error("Sammel-Statement konnte nicht angelegt werden:", error?.message)
    return null
  }
  return neu.id as string
}

/**
 * Versendet eine Renewal-Mail an alle Admin-Benutzer, sofern seit dem
 * letzten Versand >= 20 Stunden vergangen sind (Dedup).
 */
async function versendeRenewalMailWennFaellig(
  client: SupabaseClient,
  verbindung: {
    id: string
    consent_gueltig_bis: string
    letzte_renewal_mail_am: string | null
  },
  tageVerbleibend: number
): Promise<boolean> {
  if (verbindung.letzte_renewal_mail_am) {
    const letzte = new Date(verbindung.letzte_renewal_mail_am)
    const stundenSeitLetzter =
      (Date.now() - letzte.getTime()) / (1000 * 60 * 60)
    if (stundenSeitLetzter < 20) {
      return false
    }
  }

  const { data: admins } = await client
    .from("user_profiles")
    .select("email")
    .eq("role", "admin")

  if (!admins || admins.length === 0) return false

  let mindestensEine = false
  for (const admin of admins) {
    if (!admin.email) continue
    const res = await sendeConsentRenewalEmail({
      empfaenger: admin.email as string,
      tageBisAblauf: tageVerbleibend,
      ablaufDatum: verbindung.consent_gueltig_bis,
    })
    if (res.success) mindestensEine = true
  }

  if (mindestensEine) {
    await client
      .from("psd2_verbindungen")
      .update({ letzte_renewal_mail_am: new Date().toISOString() })
      .eq("id", verbindung.id)
  }
  return mindestensEine
}
