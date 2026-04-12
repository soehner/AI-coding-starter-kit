"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import type {
  CategorizationRule,
  RuleCombinator,
  RuleCriterion,
} from "@/lib/types"

/**
 * PROJ-13: Client-Store für Kategorisierungsregeln.
 *
 * - Lädt die Regelliste einmalig vom Server und teilt sie modulweit.
 * - Admin-Mutationen (Create/Update/Delete/Reorder) gehen direkt an die
 *   API-Routen und aktualisieren anschließend den lokalen Store.
 *
 * Admin-Routen:
 *   GET/POST   /api/admin/categorization-rules
 *   PATCH/DELETE /api/admin/categorization-rules/[id]
 *   POST       /api/admin/categorization-rules/apply
 */

type Listener = () => void

const listeners = new Set<Listener>()
let state: CategorizationRule[] = []
let isLoaded = false
let isFetching = false
let loadError: string | null = null
let pendingLoad: Promise<void> | null = null

function notify() {
  listeners.forEach((l) => l())
}

function setState(next: CategorizationRule[]) {
  state = next
  notify()
}

export async function fetchCategorizationRules(): Promise<void> {
  if (pendingLoad) return pendingLoad
  isFetching = true
  loadError = null
  notify()

  pendingLoad = (async () => {
    try {
      const res = await fetch("/api/admin/categorization-rules", {
        credentials: "include",
      })
      if (res.status === 401 || res.status === 403) {
        setState([])
        isLoaded = true
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Fehler beim Laden der Regeln")
      }
      const data = await res.json()
      const rules: CategorizationRule[] = data.rules ?? []
      setState(rules.sort((a, b) => a.sort_order - b.sort_order))
      isLoaded = true
    } catch (err) {
      loadError =
        err instanceof Error ? err.message : "Fehler beim Laden der Regeln"
      setState([])
    } finally {
      isFetching = false
      pendingLoad = null
      notify()
    }
  })()

  return pendingLoad
}

function ensureLoaded() {
  if (!isLoaded && !isFetching && typeof window !== "undefined") {
    fetchCategorizationRules()
  }
}

function subscribe(listener: Listener): () => void {
  ensureLoaded()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): CategorizationRule[] {
  return state
}

function getServerSnapshot(): CategorizationRule[] {
  return []
}

/**
 * Liefert die aktuelle Regelliste aus dem Modul-Store (sortiert nach sort_order).
 */
export function useCategorizationRules(): CategorizationRule[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Liefert Ladezustand / Fehler der Regel-Liste.
 */
export function useCategorizationRulesStatus(): {
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
} {
  const [, forceRender] = useState(0)

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const reload = useCallback(async () => {
    isLoaded = false
    await fetchCategorizationRules()
  }, [])

  return {
    isLoading: isFetching && !isLoaded,
    error: loadError,
    reload,
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

interface CreateRulePayload {
  name: string
  combinator: RuleCombinator
  criteria: RuleCriterion[]
  category_id: string
  is_active?: boolean
}

export async function createCategorizationRule(
  payload: CreateRulePayload
): Promise<CategorizationRule> {
  const res = await fetch("/api/admin/categorization-rules", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || "Fehler beim Anlegen der Regel")
  }
  const created: CategorizationRule = data.rule
  setState(
    [...state, created].sort((a, b) => a.sort_order - b.sort_order)
  )
  return created
}

interface UpdateRulePayload {
  name?: string
  combinator?: RuleCombinator
  criteria?: RuleCriterion[]
  category_id?: string
  is_active?: boolean
  sort_order?: number
}

export async function updateCategorizationRule(
  id: string,
  payload: UpdateRulePayload
): Promise<CategorizationRule> {
  const res = await fetch(`/api/admin/categorization-rules/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || "Fehler beim Speichern der Regel")
  }
  const updated: CategorizationRule = data.rule
  setState(
    state
      .map((r) => (r.id === id ? { ...r, ...updated } : r))
      .sort((a, b) => a.sort_order - b.sort_order)
  )
  return updated
}

/**
 * PROJ-13 BUG-008: Rein lokale Store-Patch-Funktion für optimistische
 * Updates. Verändert keinen Server-Zustand — nur den Client-Cache. Wird
 * vom Toggle-Handler in der Regelliste genutzt, damit der Switch sofort
 * umspringt und bei Fehlschlag zurückgerollt werden kann.
 */
export function patchCategorizationRuleLocal(
  id: string,
  patch: Partial<CategorizationRule>
): void {
  setState(
    state.map((r) => (r.id === id ? { ...r, ...patch } : r))
  )
}

export async function deleteCategorizationRule(id: string): Promise<void> {
  const res = await fetch(`/api/admin/categorization-rules/${id}`, {
    method: "DELETE",
    credentials: "include",
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || "Fehler beim Löschen der Regel")
  }
  setState(state.filter((r) => r.id !== id))
}

/**
 * Persistiert eine neue Reihenfolge (sort_order) für alle Regeln.
 * Die übergebene Reihenfolge entspricht der gewünschten Anzeige-Reihenfolge.
 */
export async function reorderCategorizationRules(
  orderedIds: string[]
): Promise<void> {
  // Optimistisches Update
  const byId = new Map(state.map((r) => [r.id, r]))
  const next = orderedIds
    .map((id, idx) => {
      const rule = byId.get(id)
      return rule ? { ...rule, sort_order: idx } : null
    })
    .filter((r): r is CategorizationRule => r !== null)
  setState(next)

  const res = await fetch("/api/admin/categorization-rules/reorder", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ordered_ids: orderedIds }),
  })
  if (!res.ok) {
    // Im Fehlerfall neu laden, damit der Store konsistent bleibt
    isLoaded = false
    await fetchCategorizationRules()
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || "Fehler beim Speichern der Reihenfolge")
  }
}

export interface ApplyRulesProgress {
  /** Gesamtanzahl der Buchungen, die verarbeitet werden sollen. */
  total: number
  /** Anzahl der bisher verarbeiteten Buchungen. */
  processed: number
  /** Aktuell verarbeiteter Chunk (1-basiert). */
  chunkIndex: number
  /** Gesamtanzahl der Chunks. */
  chunkCount: number
}

export interface ApplyRulesResult {
  processed: number
  categorized: number
  assignmentsCreated: number
}

/**
 * Chunk-Größe für die Verarbeitung im Backend. Klein genug, damit ein
 * Request nicht in Vercel-Timeouts läuft (Default 10–60 s), groß genug,
 * damit der HTTP-Overhead bei großen Datenbeständen im Rahmen bleibt.
 */
const APPLY_CHUNK_SIZE = 200

/**
 * PROJ-13 BUG-004: Wendet die aktiven Regeln auf bestehende Buchungen an
 * und liefert während der Verarbeitung echte Fortschritts-Updates.
 *
 * Ablauf:
 *   1. `/apply/plan` liefert alle Buchungs-IDs für den gewählten Scope.
 *   2. Die IDs werden clientseitig in Chunks zu {@link APPLY_CHUNK_SIZE}
 *      aufgeteilt.
 *   3. Für jeden Chunk wird `/apply` mit expliziter ID-Liste aufgerufen;
 *      nach jedem Chunk feuert `onProgress`, sodass das Dialog-UI eine
 *      echte Progress-Bar statt eines indeterminierten Spinners zeigen
 *      kann.
 *
 * Vorteile gegenüber einem Einzel-Request:
 *   - Kein Timeout bei großen Datenbeständen (1000+ Buchungen).
 *   - Echte Fortschrittsanzeige.
 *   - Abbruch zwischen Chunks grundsätzlich möglich (via `AbortSignal`).
 */
export async function applyCategorizationRules(
  scope: "uncategorized" | "all",
  options?: {
    onProgress?: (progress: ApplyRulesProgress) => void
    signal?: AbortSignal
  }
): Promise<ApplyRulesResult> {
  const { onProgress, signal } = options ?? {}

  // 1. Plan holen
  const planRes = await fetch("/api/admin/categorization-rules/apply/plan", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope }),
    signal,
  })
  const planData = await planRes.json().catch(() => ({}))
  if (!planRes.ok) {
    throw new Error(planData.error || "Fehler beim Ermitteln der Buchungen")
  }
  const transactionIds: string[] = planData.transaction_ids ?? []
  const total = transactionIds.length

  if (total === 0) {
    onProgress?.({ total: 0, processed: 0, chunkIndex: 0, chunkCount: 0 })
    return { processed: 0, categorized: 0, assignmentsCreated: 0 }
  }

  // 2. In Chunks aufteilen
  const chunks: string[][] = []
  for (let i = 0; i < transactionIds.length; i += APPLY_CHUNK_SIZE) {
    chunks.push(transactionIds.slice(i, i + APPLY_CHUNK_SIZE))
  }

  // Initiales Event, damit das UI sofort 0 / total anzeigen kann
  onProgress?.({
    total,
    processed: 0,
    chunkIndex: 0,
    chunkCount: chunks.length,
  })

  // 3. Chunk-weise verarbeiten
  let processed = 0
  let categorized = 0
  let assignmentsCreated = 0

  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) {
      throw new DOMException("Verarbeitung abgebrochen", "AbortError")
    }

    const chunk = chunks[i]
    const res = await fetch("/api/admin/categorization-rules/apply", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_ids: chunk }),
      signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || "Fehler beim Anwenden der Regeln")
    }

    processed += data.processed ?? 0
    categorized += data.categorized ?? 0
    assignmentsCreated += data.assignments_created ?? 0

    onProgress?.({
      total,
      processed,
      chunkIndex: i + 1,
      chunkCount: chunks.length,
    })
  }

  return { processed, categorized, assignmentsCreated }
}
