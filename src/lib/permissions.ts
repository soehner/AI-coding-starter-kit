import { createServerSupabaseClient } from "@/lib/supabase-server"
import type { PermissionKey } from "@/lib/types"

/**
 * Prüft ob ein Benutzer eine bestimmte Feature-Berechtigung hat.
 *
 * Logik:
 * - Admins haben immer alle Berechtigungen (user_permissions wird ignoriert)
 * - Betrachter benötigen einen expliziten Eintrag in user_permissions
 * - Fehlende user_permissions-Zeile = keine Berechtigung
 *
 * @returns true wenn berechtigt, false wenn nicht
 */
export async function hasPermission(
  userId: string,
  permission: PermissionKey
): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  // Profil laden um Rolle zu prüfen
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .single()

  if (profileError || !profile) {
    return false
  }

  // Admins haben immer alle Berechtigungen
  if (profile.role === "admin") {
    return true
  }

  // Für Betrachter: user_permissions prüfen
  const { data: permissions, error: permError } = await supabase
    .from("user_permissions")
    .select("edit_transactions, export_excel, import_statements")
    .eq("user_id", userId)
    .single()

  if (permError || !permissions) {
    return false
  }

  return (permissions as Record<string, boolean>)[permission] === true
}

/**
 * Lädt alle Berechtigungen eines Benutzers.
 * Gibt null zurück wenn keine gefunden.
 */
export async function getUserPermissions(userId: string) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from("user_permissions")
    .select("user_id, edit_transactions, export_excel, import_statements, updated_at")
    .eq("user_id", userId)
    .single()

  if (error || !data) {
    return null
  }

  return data
}
