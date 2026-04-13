/**
 * PROJ-14: Kategoriebasierter Zugriff für Betrachter
 *
 * Zentrale Helferfunktionen zum Ermitteln der Kategorie-Einschränkung eines
 * Benutzers. Wird von allen API-Routen genutzt, die Buchungen liefern
 * (Dashboard, Summary, Export, Einzelabfrage).
 */

import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import type { UserRole } from "@/lib/types"

/**
 * Ergebnis der Filter-Ermittlung.
 *
 * - `restricted = false`  → Benutzer sieht ALLE Buchungen (kein Filter).
 *   Das ist der Standardfall für Admins und für Betrachter ohne Einträge in
 *   `user_category_access`.
 * - `restricted = true`   → Benutzer sieht nur Buchungen, die mindestens
 *   einer Kategorie aus `allowedCategoryIds` zugeordnet sind. Unkategorisierte
 *   Buchungen sind NICHT sichtbar. `allowedCategoryIds` kann leer sein — dann
 *   sieht der Benutzer keine Buchungen (aber keinen Fehler).
 */
export type CategoryFilter =
  | { restricted: false }
  | { restricted: true; allowedCategoryIds: string[] }

/**
 * Ermittelt den Kategorie-Filter für einen Benutzer anhand dessen Rolle und
 * der Einträge in `user_category_access`.
 *
 * Admins erhalten IMMER `{ restricted: false }`, unabhängig davon, ob Einträge
 * in der Zugriffstabelle existieren. Dies ist eine serverseitige Absicherung
 * zusätzlich zur RLS.
 */
export async function getCategoryFilter(
  userId: string,
  role: UserRole
): Promise<CategoryFilter> {
  if (role === "admin") {
    return { restricted: false }
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from("user_category_access")
    .select("category_id")
    .eq("user_id", userId)

  if (error) {
    // BUG-2: Bei einem DB-Fehler werfen wir die Exception, damit die
    // aufrufende Route mit 500 antwortet. Vorher wurde fälschlich eine
    // leere erlaubte Menge zurückgegeben — dadurch sahen uneingeschränkte
    // Betrachter bei transienten DB-Fehlern plötzlich keine Buchungen,
    // obwohl sie eigentlich uneingeschränkten Zugriff haben.
    console.error(
      "Fehler beim Laden des Kategorie-Zugriffs:",
      error.message
    )
    throw new Error(
      "Kategorie-Zugriff konnte nicht geladen werden: " + error.message
    )
  }

  const ids = (data ?? []).map((row) => row.category_id as string)

  // Keine Einträge → uneingeschränkter Zugriff (kein Filter)
  if (ids.length === 0) {
    return { restricted: false }
  }

  return { restricted: true, allowedCategoryIds: ids }
}

/**
 * Prüft, ob eine bestimmte Transaktion für den gegebenen Filter sichtbar ist.
 * Wird von Einzelabfrage-/PATCH-Routen genutzt, um 404 zurückzugeben, falls
 * der Benutzer die Buchung nicht sehen darf.
 */
export async function isTransactionVisible(
  transactionId: string,
  filter: CategoryFilter
): Promise<boolean> {
  if (!filter.restricted) {
    return true
  }

  if (filter.allowedCategoryIds.length === 0) {
    return false
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from("transaction_categories")
    .select("transaction_id")
    .eq("transaction_id", transactionId)
    .in("category_id", filter.allowedCategoryIds)
    .limit(1)

  if (error) {
    // BUG-2: DB-Fehler durchreichen, statt fälschlich 404 zu signalisieren
    console.error(
      "Fehler bei der Sichtbarkeitsprüfung einer Buchung:",
      error.message
    )
    throw new Error(
      "Sichtbarkeit der Buchung konnte nicht geprüft werden: " + error.message
    )
  }

  return (data ?? []).length > 0
}

/**
 * Admin-Variante zum Lesen der Kategorie-Zugriffseinstellungen eines
 * beliebigen Benutzers. Umgeht RLS per Admin-Client, darf also nur in
 * Admin-Routen aufgerufen werden.
 */
export async function getCategoryAccessForUser(
  targetUserId: string
): Promise<string[]> {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from("user_category_access")
    .select("category_id")
    .eq("user_id", targetUserId)

  if (error) {
    throw new Error(
      "Kategorie-Zugriff konnte nicht geladen werden: " + error.message
    )
  }

  return (data ?? []).map((row) => row.category_id as string)
}
