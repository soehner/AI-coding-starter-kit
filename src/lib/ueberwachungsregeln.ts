/**
 * PROJ-18: Überwachungsregeln – Matching, Klartext-Beschreibung und die
 * serverseitige Prüfung, die im PSD2-Cron nach der Kategorisierung läuft.
 *
 * Die Prüfung ist rein deterministisch (keine KI zur Laufzeit). Die KI wird
 * ausschließlich beim Erstellen einer Regel zur Übersetzung des Freitextes
 * genutzt (siehe ki-parser.ts).
 *
 * Die Prüffunktion erwartet einen Supabase-Client mit ausreichenden
 * Leserechten auf `transactions` und Schreibrechten auf
 * `ueberwachungs_benachrichtigungen` — in der Praxis den Service-Role-Client
 * aus dem Cron-Kontext (kein Benutzer-Session).
 */

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  UeberwachungsBedingung,
  UeberwachungsCriterion,
  UeberwachungsRegelTyp,
  Ueberwachungsregel,
} from "@/lib/types"
import { sendeUeberwachungsEmail } from "@/lib/ueberwachungs-emails"

/**
 * Deterministischer, längenbegrenzter Fingerabdruck einer Menge von
 * Buchungs-IDs. Reihenfolge-unabhängig (Sortierung vor dem Hashen), damit
 * dieselbe Buchungsmenge über verschiedene Läufe denselben Schlüssel liefert
 * (Idempotenz), unterschiedliche Mengen aber garantiert verschiedene.
 */
function fingerabdruckBuchungen(ids: string[]): string {
  const sortiert = [...ids].sort()
  return createHash("sha256").update(sortiert.join(",")).digest("hex").slice(0, 32)
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** Minimal-Shape einer Buchung für die reine Regel-Prüfung. */
export interface MatchableWatchTx {
  id: string
  description: string
  counterpart: string | null
  amount: number
  booking_date: string
  iban_gegenseite: string | null
}

/** Prüft, ob ein einzelnes Kriterium auf eine Buchung zutrifft. */
export function watchCriterionMatches(
  criterion: UeberwachungsCriterion,
  tx: MatchableWatchTx
): boolean {
  switch (criterion.type) {
    case "text_contains": {
      if (!criterion.term) return false
      return tx.description
        .toLowerCase()
        .includes(criterion.term.toLowerCase())
    }
    case "counterpart_contains": {
      if (!criterion.term) return false
      if (!tx.counterpart) return false
      return tx.counterpart
        .toLowerCase()
        .includes(criterion.term.toLowerCase())
    }
    case "amount_range": {
      const { min, max, direction } = criterion
      if (
        typeof min !== "number" ||
        typeof max !== "number" ||
        !direction
      ) {
        return false
      }
      if (direction === "in" && tx.amount <= 0) return false
      if (direction === "out" && tx.amount >= 0) return false
      const abs = Math.abs(tx.amount)
      return abs >= min && abs <= max
    }
    case "iban_equals": {
      if (!criterion.iban) return false
      if (!tx.iban_gegenseite) return false
      return (
        tx.iban_gegenseite.replace(/\s/g, "").toUpperCase() ===
        criterion.iban.replace(/\s/g, "").toUpperCase()
      )
    }
    default:
      return false
  }
}

/**
 * Prüft, ob die Kriterien einer Bedingung (verknüpft per AND/OR) auf eine
 * Buchung zutreffen. Das `muster`-Objekt wird hier NICHT ausgewertet — es
 * beschreibt nur die Aggregation über mehrere Buchungen.
 */
export function bedingungMatchesBuchung(
  bedingung: UeberwachungsBedingung,
  tx: MatchableWatchTx
): boolean {
  const criteria = bedingung.criteria ?? []
  if (criteria.length === 0) return false
  if (bedingung.combinator === "OR") {
    return criteria.some((c) => watchCriterionMatches(c, tx))
  }
  return criteria.every((c) => watchCriterionMatches(c, tx))
}

// ---------------------------------------------------------------------------
// Klartext-Beschreibung
// ---------------------------------------------------------------------------

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
})

function formatEuro(value: number): string {
  return euroFormatter.format(value)
}

function beschreibeCriterion(criterion: UeberwachungsCriterion): string {
  switch (criterion.type) {
    case "amount_range": {
      const richtung =
        criterion.direction === "out"
          ? "Abbuchungen"
          : criterion.direction === "in"
            ? "Gutschriften"
            : "Beträge"
      return `${richtung} zwischen ${formatEuro(criterion.min)} und ${formatEuro(
        criterion.max
      )}`
    }
    case "text_contains":
      return `der Verwendungszweck „${criterion.term}" enthält`
    case "counterpart_contains":
      return `der Empfänger/Auftraggeber „${criterion.term}" enthält`
    case "iban_equals":
      return `die IBAN der Gegenseite ${criterion.iban} ist`
    default:
      return "unbekanntes Kriterium"
  }
}

/**
 * Erzeugt eine deterministische, verständliche Klartext-Zusammenfassung
 * dessen, was eine Regel prüft. Bewusst serverseitig (nicht aus KI-Rohtext),
 * damit die Anzeige immer der tatsächlich gespeicherten Bedingung entspricht.
 */
export function beschreibeUeberwachungsregel(
  regelTyp: UeberwachungsRegelTyp,
  bedingung: UeberwachungsBedingung
): string {
  const criteria = bedingung.criteria ?? []
  const verknuepfung = bedingung.combinator === "OR" ? " oder " : " und "
  const kriterienText =
    criteria.length > 0
      ? criteria.map(beschreibeCriterion).join(verknuepfung)
      : "(keine Kriterien)"

  if (regelTyp === "muster" && bedingung.muster) {
    const { art, schwelle, zeitfenster_tage } = bedingung.muster
    const musterText =
      art === "anzahl"
        ? `mindestens ${schwelle}-mal innerhalb von ${zeitfenster_tage} Tagen`
        : `in Summe mehr als ${formatEuro(schwelle)} innerhalb von ${zeitfenster_tage} Tagen`
    return `Benachrichtigung, wenn Buchungen (${kriterienText}) ${musterText} auftreten.`
  }

  return `Benachrichtigung, wenn eine Buchung folgende Bedingung erfüllt: ${kriterienText}.`
}

// ---------------------------------------------------------------------------
// Prüfung im Cron-Kontext
// ---------------------------------------------------------------------------

export interface UeberwachungsPruefErgebnis {
  /** Anzahl aktiver Regeln, die geprüft wurden. */
  regelnGeprueft: number
  /** Anzahl versendeter Benachrichtigungen (ein Treffer = eine Benachrichtigung). */
  benachrichtigungen: number
  /** Warnung, falls die Prüfung teilweise/ganz scheiterte (blockiert den Sync nicht). */
  warnung?: string
}

const MAX_NEUE_TX = 5000
const MAX_FENSTER_TX = 20000

interface DbTxRow {
  id: string
  description: string | null
  counterpart: string | null
  amount: number
  booking_date: string
  iban_gegenseite: string | null
}

function toMatchable(row: DbTxRow): MatchableWatchTx {
  return {
    id: row.id,
    description: row.description ?? "",
    counterpart: row.counterpart,
    amount: row.amount,
    booking_date: row.booking_date,
    iban_gegenseite: row.iban_gegenseite,
  }
}

interface EmailBuchung {
  datum: string
  betrag: number
  gegenseite: string | null
  verwendungszweck: string
}

function toEmailBuchung(tx: MatchableWatchTx): EmailBuchung {
  return {
    datum: tx.booking_date,
    betrag: tx.amount,
    gegenseite: tx.counterpart,
    verwendungszweck: tx.description,
  }
}

/** Zieht `tage` Tage von einem ISO-Datum (YYYY-MM-DD) ab. */
function datumMinusTage(dateStr: string, tage: number): string {
  const d = new Date(dateStr + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() - tage)
  return d.toISOString().slice(0, 10)
}

/**
 * Hauptfunktion: prüft alle aktiven Überwachungsregeln gegen die im aktuellen
 * Lauf neu importierten Buchungen und versendet bei Treffern Benachrichtigungen.
 *
 * Fehlertolerant konzipiert — der Aufrufer (sync.ts) fängt Ausnahmen zusätzlich
 * ab, damit ein Fehler hier den PSD2-Import nicht kippt.
 */
export async function pruefeUeberwachungsregeln(
  client: SupabaseClient,
  neueTransaktionIds: string[]
): Promise<UeberwachungsPruefErgebnis> {
  if (neueTransaktionIds.length === 0) {
    return { regelnGeprueft: 0, benachrichtigungen: 0 }
  }

  // 1. Aktive Regeln laden
  const { data: regelnData, error: regelnError } = await client
    .from("ueberwachungsregeln")
    .select(
      "id, name, freitext_original, regel_typ, bedingung, empfaenger, ist_aktiv, sortierung, erstellt_am, erstellt_von"
    )
    .eq("ist_aktiv", true)
    .order("sortierung", { ascending: true })
    .limit(500)

  if (regelnError) {
    throw new Error(
      `Überwachungsregeln konnten nicht geladen werden: ${regelnError.message}`
    )
  }

  const regeln = (regelnData ?? []) as Ueberwachungsregel[]
  if (regeln.length === 0) {
    return { regelnGeprueft: 0, benachrichtigungen: 0 }
  }

  // 2. Neu importierte Buchungen laden (Batch-weise, gedeckelt)
  const begrenzteIds = neueTransaktionIds.slice(0, MAX_NEUE_TX)
  const neueBuchungen = await ladeBuchungenNachIds(client, begrenzteIds)
  if (neueBuchungen.length === 0) {
    return { regelnGeprueft: regeln.length, benachrichtigungen: 0 }
  }

  // 3. Bereits protokollierte Dedup-Schlüssel für die relevanten Regeln laden,
  //    damit dieselbe Kombination nicht erneut auslöst.
  const regelIds = regeln.map((r) => r.id)
  const bekannteDedupKeys = await ladeBekannteDedupKeys(client, regelIds)

  let benachrichtigungen = 0
  const warnungen: string[] = []

  for (const regel of regeln) {
    try {
      const gesendet =
        regel.regel_typ === "muster"
          ? await pruefeMusterRegel(
              client,
              regel,
              neueBuchungen,
              bekannteDedupKeys
            )
          : await pruefeEinzelbuchungsRegel(
              client,
              regel,
              neueBuchungen,
              bekannteDedupKeys
            )
      benachrichtigungen += gesendet
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error(
        `Überwachungsregel "${regel.name}" (${regel.id}) fehlgeschlagen:`,
        detail
      )
      warnungen.push(`Regel "${regel.name}": ${detail}`)
    }
  }

  return {
    regelnGeprueft: regeln.length,
    benachrichtigungen,
    warnung: warnungen.length > 0 ? warnungen.join(" | ") : undefined,
  }
}

/**
 * Einzelbuchungs-Regel: prüft jede neue Buchung. Alle (noch nicht
 * deduplizierten) Treffer werden pro Regel zu EINER gebündelten E-Mail
 * zusammengefasst (verhindert E-Mail-Flut beim Backfill).
 *
 * @returns 1, wenn eine Benachrichtigung versendet wurde, sonst 0.
 */
async function pruefeEinzelbuchungsRegel(
  client: SupabaseClient,
  regel: Ueberwachungsregel,
  neueBuchungen: MatchableWatchTx[],
  bekannteDedupKeys: Set<string>
): Promise<number> {
  const treffer: MatchableWatchTx[] = []
  const dedupKeys: string[] = []

  for (const tx of neueBuchungen) {
    if (!bedingungMatchesBuchung(regel.bedingung, tx)) continue
    const dedupKey = `einzel:${regel.id}:${tx.id}`
    if (bekannteDedupKeys.has(dedupKey)) continue
    treffer.push(tx)
    dedupKeys.push(dedupKey)
    // Innerhalb desselben Laufs nicht doppelt aufnehmen
    bekannteDedupKeys.add(dedupKey)
  }

  if (treffer.length === 0) return 0

  // Ein gemeinsamer Dedup-Eintrag pro Lauf für die gebündelte Mail.
  // Zusätzlich sichern die Einzel-Keys, dass keine Buchung erneut gemeldet wird.
  //
  // Der Bündel-Schlüssel wird aus den betroffenen Buchungs-IDs abgeleitet
  // (nicht aus Datum + Anzahl). Sonst kollidieren zwei Läufe am selben Tag mit
  // gleich vielen, aber unterschiedlichen neuen Buchungen — der zweite Versand
  // liefe in den Unique-Konflikt und der Alarm ginge verloren.
  const versandDedupKey =
    treffer.length === 1
      ? dedupKeys[0]
      : `einzel-bundle:${regel.id}:${fingerabdruckBuchungen(
          treffer.map((t) => t.id)
        )}`

  const versendetAn = await versendeUndProtokolliere(
    client,
    regel,
    treffer,
    dedupKeys,
    versandDedupKey
  )

  return versendetAn.length > 0 ? 1 : 0
}

/**
 * Muster-Regel: erkennt wiederkehrende Buchungen über ein Zeitfenster.
 * Wird nur ausgelöst, wenn mindestens eine NEUE Buchung Teil des Musters ist.
 * Dedup über den Fingerabdruck der tatsächlich beteiligten Buchungsmenge — so
 * meldet dasselbe Muster bei einem erneuten Cron-Lauf nicht doppelt, während
 * ein inhaltlich anderes Muster (andere Buchungen) korrekt eigenständig
 * gemeldet wird — auch innerhalb desselben Kalendermonats.
 *
 * @returns 1, wenn eine Benachrichtigung versendet wurde, sonst 0.
 */
async function pruefeMusterRegel(
  client: SupabaseClient,
  regel: Ueberwachungsregel,
  neueBuchungen: MatchableWatchTx[],
  bekannteDedupKeys: Set<string>
): Promise<number> {
  const muster = regel.bedingung.muster
  if (!muster) return 0

  // Nur neue Buchungen, die die Kriterien erfüllen, kommen als Auslöser infrage.
  const neueTreffer = neueBuchungen.filter((tx) =>
    bedingungMatchesBuchung(regel.bedingung, tx)
  )
  if (neueTreffer.length === 0) return 0

  const maxDatum = neueTreffer
    .map((t) => t.booking_date)
    .reduce((a, b) => (a > b ? a : b))
  const fensterStart = datumMinusTage(maxDatum, muster.zeitfenster_tage)

  // Alle Buchungen im relevanten Zeitfenster laden (auch bereits vorhandene),
  // danach in-memory gegen die Kriterien filtern.
  const fensterRows = await ladeBuchungenImZeitraum(
    client,
    fensterStart,
    maxDatum
  )
  const passende = fensterRows.filter((tx) =>
    bedingungMatchesBuchung(regel.bedingung, tx)
  )

  const schwelleErreicht =
    muster.art === "anzahl"
      ? passende.length >= muster.schwelle
      : passende.reduce((sum, t) => sum + Math.abs(t.amount), 0) >=
        muster.schwelle

  if (!schwelleErreicht) return 0

  // Inhaltsbasierter Dedup-Schlüssel (Muster + Fingerabdruck der beteiligten
  // Buchungen). Verhindert Doppelmeldung derselben Buchungsmenge, meldet aber
  // ein neues Muster mit anderen Buchungen eigenständig — auch im selben Monat.
  const dedupKey = `muster:${regel.id}:${fingerabdruckBuchungen(
    passende.map((p) => p.id)
  )}`
  if (bekannteDedupKeys.has(dedupKey)) return 0
  bekannteDedupKeys.add(dedupKey)

  // Beteiligte Buchungen (chronologisch) für die E-Mail und das Protokoll.
  const beteiligte = [...passende].sort((a, b) =>
    a.booking_date < b.booking_date ? -1 : 1
  )

  const versendetAn = await versendeUndProtokolliere(
    client,
    regel,
    beteiligte,
    [],
    dedupKey
  )

  return versendetAn.length > 0 ? 1 : 0
}

/**
 * Reserviert zuerst den Dedup-Schlüssel (INSERT gegen den Unique-Index),
 * versendet dann die E-Mail und aktualisiert den Protokolleintrag mit den
 * tatsächlich erreichten Empfängern. Verhindert Doppel-Versand bei
 * überlappenden Cron-Läufen.
 */
async function versendeUndProtokolliere(
  client: SupabaseClient,
  regel: Ueberwachungsregel,
  buchungen: MatchableWatchTx[],
  zusaetzlicheDedupKeys: string[],
  versandDedupKey: string
): Promise<string[]> {
  // 1. Dedup-Eintrag reservieren. Konflikt = bereits gemeldet → nichts tun.
  const { error: insertError } = await client
    .from("ueberwachungs_benachrichtigungen")
    .insert({
      regel_id: regel.id,
      regel_name_stand: regel.name,
      betroffene_buchungen: buchungen.map((b) => b.id),
      dedup_schluessel: versandDedupKey,
      versendet_an: [],
    })

  if (insertError) {
    if (insertError.code === "23505") {
      // Bereits protokolliert (Race/erneuter Lauf) → nicht erneut senden.
      return []
    }
    throw new Error(
      `Protokolleintrag konnte nicht angelegt werden: ${insertError.message}`
    )
  }

  // 2. Zusätzliche Einzel-Dedup-Keys (Einzelbuchungs-Bündel) protokollieren,
  //    damit jede einzelne Buchung dauerhaft als gemeldet gilt.
  if (zusaetzlicheDedupKeys.length > 0) {
    const zusatzRows = zusaetzlicheDedupKeys
      .filter((k) => k !== versandDedupKey)
      .map((k, i) => ({
        regel_id: regel.id,
        regel_name_stand: regel.name,
        betroffene_buchungen: buchungen[i] ? [buchungen[i].id] : [],
        dedup_schluessel: k,
        versendet_an: [] as string[],
      }))
    if (zusatzRows.length > 0) {
      // Konflikte einzeln ignorieren (upsert-artig via ignoreDuplicates).
      await client
        .from("ueberwachungs_benachrichtigungen")
        .upsert(zusatzRows, {
          onConflict: "dedup_schluessel",
          ignoreDuplicates: true,
        })
    }
  }

  // 3. E-Mail versenden (pro Empfänger isoliert).
  const zusammenfassung = beschreibeUeberwachungsregel(
    regel.regel_typ,
    regel.bedingung
  )
  const { versendetAn, fehler } = await sendeUeberwachungsEmail({
    empfaenger: regel.empfaenger,
    regelName: regel.name,
    zusammenfassung,
    buchungen: buchungen.map(toEmailBuchung),
  })

  if (fehler.length > 0) {
    console.error(
      `Überwachungsregel "${regel.name}": Versand-Fehler an ${fehler.join(", ")}`
    )
  }

  // 4. Protokoll mit tatsächlich erreichten Empfängern aktualisieren.
  await client
    .from("ueberwachungs_benachrichtigungen")
    .update({ versendet_an: versendetAn })
    .eq("dedup_schluessel", versandDedupKey)

  return versendetAn
}

// ---------------------------------------------------------------------------
// DB-Hilfsfunktionen
// ---------------------------------------------------------------------------

const TX_COLUMNS =
  "id, description, counterpart, amount, booking_date, iban_gegenseite"

async function ladeBuchungenNachIds(
  client: SupabaseClient,
  ids: string[]
): Promise<MatchableWatchTx[]> {
  const BATCH = 500
  const result: MatchableWatchTx[] = []
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH)
    const { data, error } = await client
      .from("transactions")
      .select(TX_COLUMNS)
      .in("id", batch)
      .limit(BATCH)
    if (error) {
      throw new Error(`Buchungen konnten nicht geladen werden: ${error.message}`)
    }
    for (const row of (data ?? []) as DbTxRow[]) {
      result.push(toMatchable(row))
    }
  }
  return result
}

async function ladeBuchungenImZeitraum(
  client: SupabaseClient,
  von: string,
  bis: string
): Promise<MatchableWatchTx[]> {
  const PAGE = 1000
  const result: MatchableWatchTx[] = []
  let from = 0
  for (;;) {
    const { data, error } = await client
      .from("transactions")
      .select(TX_COLUMNS)
      .gte("booking_date", von)
      .lte("booking_date", bis)
      .order("booking_date", { ascending: true })
      .range(from, from + PAGE - 1)
      .limit(PAGE)
    if (error) {
      throw new Error(
        `Zeitfenster-Buchungen konnten nicht geladen werden: ${error.message}`
      )
    }
    const batch = (data ?? []) as DbTxRow[]
    for (const row of batch) result.push(toMatchable(row))
    if (batch.length < PAGE) break
    from += PAGE
    if (result.length >= MAX_FENSTER_TX) break
  }
  return result
}

async function ladeBekannteDedupKeys(
  client: SupabaseClient,
  regelIds: string[]
): Promise<Set<string>> {
  if (regelIds.length === 0) return new Set()
  const keys = new Set<string>()
  const PAGE = 1000
  let from = 0
  for (;;) {
    const { data, error } = await client
      .from("ueberwachungs_benachrichtigungen")
      .select("dedup_schluessel")
      .in("regel_id", regelIds)
      .range(from, from + PAGE - 1)
    if (error) {
      throw new Error(
        `Dedup-Schlüssel konnten nicht geladen werden: ${error.message}`
      )
    }
    const batch = (data ?? []) as { dedup_schluessel: string }[]
    for (const row of batch) keys.add(row.dedup_schluessel)
    if (batch.length < PAGE) break
    from += PAGE
  }
  return keys
}
