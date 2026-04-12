/**
 * PROJ-13: Serverseitige Regelanwendung.
 *
 * Diese Funktion wird sowohl beim Import (PROJ-3) als auch beim manuellen
 * „Regeln jetzt anwenden" (Einstellungen) genutzt, um Logik-Duplikate zu
 * vermeiden.
 *
 * Die Funktion erwartet einen Supabase-Client mit ausreichenden Schreibrechten
 * (in der Praxis den Admin-Client, da nur Admins Regeln anwenden dürfen).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  AmountRangeCondition,
  CategorizationRule,
  MonthQuarterCondition,
  TextContainsCondition,
} from "@/lib/types"

interface TransactionRow {
  id: string
  description: string
  counterpart: string | null
  amount: number
  booking_date: string
}

/**
 * Minimal-Shape für die reine Regel-Prüfung ohne Datenbankzugriff.
 * Wird von der Import-Vorschau (PROJ-3) genutzt, um geparste Buchungen
 * vor dem Speichern mit vorgeschlagenen Kategorien zu versehen.
 */
export interface MatchableTransaction {
  description: string
  counterpart?: string | null
  amount: number
  booking_date: string
}

export interface ApplyRulesResult {
  processed: number
  categorized: number
  assignmentsCreated: number
}

/**
 * Prüft, ob eine Regel auf eine Buchung zutrifft.
 *
 * BUG-002-Fix: `counterpart_contains` matcht strikt gegen das separate
 * `counterpart`-Feld (vom KI-Parser befüllt). Bei Altdaten ohne
 * `counterpart` (NULL) matcht die Regel nicht — das ist gewollt, damit
 * es keine impliziten Treffer auf den Verwendungszweck gibt.
 */
function ruleMatches(rule: CategorizationRule, tx: MatchableTransaction): boolean {
  switch (rule.rule_type) {
    case "text_contains": {
      const cond = rule.condition as TextContainsCondition
      if (!cond?.term) return false
      return tx.description.toLowerCase().includes(cond.term.toLowerCase())
    }
    case "counterpart_contains": {
      const cond = rule.condition as TextContainsCondition
      if (!cond?.term) return false
      if (!tx.counterpart) return false
      return tx.counterpart.toLowerCase().includes(cond.term.toLowerCase())
    }
    case "amount_range": {
      const cond = rule.condition as AmountRangeCondition
      if (
        typeof cond?.min !== "number" ||
        typeof cond?.max !== "number" ||
        !cond?.direction
      ) {
        return false
      }
      // Richtungs-Check
      if (cond.direction === "in" && tx.amount <= 0) return false
      if (cond.direction === "out" && tx.amount >= 0) return false
      // Beträge werden als absolute Werte verglichen (siehe RegelFormDialog-Text).
      const abs = Math.abs(tx.amount)
      return abs >= cond.min && abs <= cond.max
    }
    case "month_quarter": {
      const cond = rule.condition as MonthQuarterCondition
      // booking_date ist ein ISO-Datum (YYYY-MM-DD). Monat direkt parsen,
      // um Zeitzonen-Artefakte zu vermeiden.
      const monthMatch = /^(\d{4})-(\d{2})-\d{2}$/.exec(tx.booking_date)
      if (!monthMatch) return false
      const month = parseInt(monthMatch[2], 10)
      if (cond?.months && cond.months.length > 0) {
        return cond.months.includes(month)
      }
      if (cond?.quarters && cond.quarters.length > 0) {
        const quarter = Math.ceil(month / 3)
        return cond.quarters.includes(quarter)
      }
      return false
    }
    default:
      return false
  }
}

/**
 * Wendet alle aktiven und gültigen Regeln auf die übergebenen Buchungen an.
 * Bestehende Kategoriezuweisungen werden NICHT überschrieben. Passt eine
 * Regel, deren Kategorie bereits zugewiesen ist, wird kein Duplikat angelegt
 * (PK auf (transaction_id, category_id) schützt zusätzlich).
 *
 * @returns Statistik über verarbeitete/kategorisierte Buchungen.
 */
export async function applyCategorizationRules(
  supabase: SupabaseClient,
  transactionIds: string[]
): Promise<ApplyRulesResult> {
  if (transactionIds.length === 0) {
    return { processed: 0, categorized: 0, assignmentsCreated: 0 }
  }

  // 1. Aktive, gültige Regeln laden (nach sort_order, rein kosmetisch)
  const { data: rules, error: rulesError } = await supabase
    .from("categorization_rules")
    .select(
      "id, name, rule_type, condition, category_id, is_active, is_invalid, sort_order, created_at"
    )
    .eq("is_active", true)
    .eq("is_invalid", false)
    .not("category_id", "is", null)
    .order("sort_order", { ascending: true })
    .limit(1000)

  if (rulesError) {
    throw new Error(`Regeln konnten nicht geladen werden: ${rulesError.message}`)
  }

  const activeRules = (rules ?? []) as CategorizationRule[]
  if (activeRules.length === 0) {
    return { processed: transactionIds.length, categorized: 0, assignmentsCreated: 0 }
  }

  // 2. Buchungen laden (Batch-weise bei großen Mengen)
  const BATCH_SIZE = 500
  let processed = 0
  let categorized = 0
  let assignmentsCreated = 0

  for (let i = 0; i < transactionIds.length; i += BATCH_SIZE) {
    const batchIds = transactionIds.slice(i, i + BATCH_SIZE)

    const { data: txs, error: txError } = await supabase
      .from("transactions")
      .select("id, description, counterpart, amount, booking_date")
      .in("id", batchIds)

    if (txError) {
      throw new Error(`Buchungen konnten nicht geladen werden: ${txError.message}`)
    }

    const batchTxs = (txs ?? []) as TransactionRow[]
    processed += batchTxs.length
    if (batchTxs.length === 0) continue

    // 3. Bereits vorhandene Zuordnungen für diesen Batch laden
    const { data: existing, error: existingError } = await supabase
      .from("transaction_categories")
      .select("transaction_id, category_id")
      .in(
        "transaction_id",
        batchTxs.map((t) => t.id)
      )

    if (existingError) {
      throw new Error(
        `Bestehende Zuordnungen konnten nicht geladen werden: ${existingError.message}`
      )
    }

    const existingSet = new Set(
      (existing ?? []).map((e) => `${e.transaction_id}:${e.category_id}`)
    )

    // 4. Zuordnungen sammeln
    const assignments: { transaction_id: string; category_id: string }[] = []
    const categorizedTxIds = new Set<string>()

    for (const tx of batchTxs) {
      for (const rule of activeRules) {
        if (!rule.category_id) continue
        if (!ruleMatches(rule, tx)) continue

        const key = `${tx.id}:${rule.category_id}`
        if (existingSet.has(key)) continue

        existingSet.add(key)
        assignments.push({
          transaction_id: tx.id,
          category_id: rule.category_id,
        })
        categorizedTxIds.add(tx.id)
      }
    }

    if (assignments.length > 0) {
      const { error: insertError } = await supabase
        .from("transaction_categories")
        .insert(assignments)

      if (insertError) {
        throw new Error(
          `Zuordnungen konnten nicht gespeichert werden: ${insertError.message}`
        )
      }
      assignmentsCreated += assignments.length
    }

    categorized += categorizedTxIds.size
  }

  return { processed, categorized, assignmentsCreated }
}

/**
 * Hartes Sicherheitslimit bei der Scope-Auflösung für „alle Buchungen".
 * Verhindert, dass der Server bei einer fehlkonfigurierten Anfrage
 * eine Millionen-Zeilen-Antwort zurückgibt.
 */
const MAX_SCOPE_TRANSACTIONS = 100_000

/**
 * PROJ-13: Löst einen Scope („uncategorized" oder „all") zu einer
 * konkreten Liste von Transaktions-IDs auf. Wird von Plan- und
 * (abwärtskompatiblem) Apply-Endpunkt genutzt.
 *
 * BUG-004: Das Frontend ruft `plan` einmal und verarbeitet die
 * zurückgegebenen IDs chunk-weise über `apply` mit echter
 * Progress-Anzeige.
 */
export async function resolveScopeTransactionIds(
  supabase: SupabaseClient,
  scope: "uncategorized" | "all"
): Promise<string[]> {
  if (scope === "uncategorized") {
    const { data, error } = await supabase.rpc("uncategorized_transaction_ids", {
      p_year: null,
      p_month: null,
      p_search: null,
    })
    if (error) {
      throw new Error(
        "Fehler beim Laden unkategorisierter Buchungen: " + error.message
      )
    }
    return ((data ?? []) as { id: string }[]).map((row) => row.id)
  }

  // scope === "all" – paginiert laden
  const PAGE_SIZE = 1000
  const ids: string[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id")
      .order("booking_date", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      throw new Error("Fehler beim Laden der Buchungen: " + error.message)
    }
    const batch = data ?? []
    ids.push(...batch.map((r) => r.id))
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
    if (ids.length >= MAX_SCOPE_TRANSACTIONS) break
  }
  return ids
}

/**
 * PROJ-13: Lädt alle aktiven und gültigen Regeln, sortiert nach `sort_order`.
 * Wird von der Import-Vorschau genutzt, um ohne Schreibzugriff passende
 * Kategorien vorzuschlagen.
 */
export async function loadActiveCategorizationRules(
  supabase: SupabaseClient
): Promise<CategorizationRule[]> {
  const { data, error } = await supabase
    .from("categorization_rules")
    .select(
      "id, name, rule_type, condition, category_id, is_active, is_invalid, sort_order, created_at"
    )
    .eq("is_active", true)
    .eq("is_invalid", false)
    .not("category_id", "is", null)
    .order("sort_order", { ascending: true })
    .limit(1000)

  if (error) {
    throw new Error(`Regeln konnten nicht geladen werden: ${error.message}`)
  }

  return (data ?? []) as CategorizationRule[]
}

/**
 * PROJ-13: Reine In-Memory-Prüfung einer Buchung gegen eine Regel-Liste.
 * Liefert die IDs aller passenden Kategorien (dedupliziert, Reihenfolge
 * entspricht `sort_order` der Regeln). Kein Datenbankzugriff, kein Schreiben.
 *
 * Wird in der Import-Vorschau (PROJ-3) verwendet, damit der Admin die
 * vorgeschlagenen Kategorien sieht, bevor er den Import bestätigt.
 */
export function matchRulesForTransaction(
  tx: MatchableTransaction,
  rules: CategorizationRule[]
): string[] {
  const matched: string[] = []
  const seen = new Set<string>()
  for (const rule of rules) {
    if (!rule.category_id) continue
    if (seen.has(rule.category_id)) continue
    if (ruleMatches(rule, tx)) {
      seen.add(rule.category_id)
      matched.push(rule.category_id)
    }
  }
  return matched
}
