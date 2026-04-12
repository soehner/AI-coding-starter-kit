"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import type { Category } from "@/lib/types"

/**
 * PROJ-12: Fetch-basierter Client-Store für Kategorien.
 *
 * - Hält die Kategorienliste modulweit im Arbeitsspeicher und informiert
 *   alle Komponenten via `useSyncExternalStore`.
 * - Lädt bei der ersten Nutzung automatisch vom Server.
 * - Admin-Aktionen (Create/Update/Delete) gehen direkt an die API-Routen
 *   und aktualisieren anschließend den lokalen Store.
 *
 * Admin-Routen: /api/admin/categories (GET, POST, PATCH, DELETE)
 */

interface CategoryWithCount extends Category {
  transaction_count?: number
}

type Listener = () => void

const listeners = new Set<Listener>()
let state: CategoryWithCount[] = []
let isLoaded = false
let isFetching = false
let loadError: string | null = null
let pendingLoad: Promise<void> | null = null

function notify() {
  listeners.forEach((l) => l())
}

function setState(next: CategoryWithCount[]) {
  state = next
  notify()
}

export async function fetchCategories(): Promise<void> {
  if (pendingLoad) return pendingLoad
  isFetching = true
  loadError = null
  notify()

  pendingLoad = (async () => {
    try {
      const res = await fetch("/api/admin/categories", {
        credentials: "include",
      })
      if (res.status === 403 || res.status === 401) {
        // Betrachter (oder nicht eingeloggt): leere Liste, kein Fehler.
        // Die Kategorien-Namen sind trotzdem in den Transaktionen selbst
        // enthalten (GET /api/transactions), sodass die Anzeige funktioniert.
        setState([])
        isLoaded = true
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Fehler beim Laden der Kategorien")
      }
      const data = await res.json()
      setState(data.categories ?? [])
      isLoaded = true
    } catch (err) {
      loadError =
        err instanceof Error ? err.message : "Fehler beim Laden der Kategorien"
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
    fetchCategories()
  }
}

function subscribe(listener: Listener): () => void {
  ensureLoaded()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): CategoryWithCount[] {
  return state
}

function getServerSnapshot(): CategoryWithCount[] {
  return []
}

/**
 * Liefert die aktuelle Kategorienliste aus dem Modul-Store.
 * Lädt automatisch beim ersten Rendern.
 */
export function useCategories(): CategoryWithCount[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Liefert Ladezustand / Fehler des Kategorien-Stores.
 */
export function useCategoriesStatus(): {
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
    await fetchCategories()
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

export async function createCategory(
  name: string,
  color: string
): Promise<CategoryWithCount> {
  const res = await fetch("/api/admin/categories", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || "Fehler beim Anlegen der Kategorie")
  }
  const created: CategoryWithCount = data.category
  setState([...state, created].sort((a, b) => a.name.localeCompare(b.name)))
  return created
}

export async function updateCategory(
  id: string,
  updates: { name?: string; color?: string }
): Promise<CategoryWithCount> {
  const res = await fetch(`/api/admin/categories/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || "Fehler beim Speichern der Kategorie")
  }
  const updated: CategoryWithCount = data.category
  setState(
    state
      .map((c) =>
        c.id === id ? { ...c, ...updated, transaction_count: c.transaction_count } : c
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  )
  return updated
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`/api/admin/categories/${id}`, {
    method: "DELETE",
    credentials: "include",
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || "Fehler beim Löschen der Kategorie")
  }
  setState(state.filter((c) => c.id !== id))
}

/**
 * Setzt die komplette Kategorienliste einer Buchung.
 */
export async function setCategoriesForTransaction(
  transactionId: string,
  categoryIds: string[]
): Promise<void> {
  const res = await fetch(`/api/transactions/${transactionId}/categories`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_ids: categoryIds }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || "Fehler beim Zuordnen der Kategorien")
  }
}

/**
 * Massenaktion: Kategorie zuweisen oder entfernen.
 * Gibt die Anzahl tatsächlich geänderter Buchungen zurück.
 */
export async function bulkCategorize(
  action: "assign" | "remove",
  transactionIds: string[],
  categoryId: string
): Promise<{ changed: number; total: number }> {
  const res = await fetch("/api/transactions/bulk-categorize", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      transaction_ids: transactionIds,
      category_id: categoryId,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || "Fehler bei der Massenaktion")
  }
  return { changed: data.changed ?? 0, total: data.total ?? 0 }
}
