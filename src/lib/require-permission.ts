import { createServerSupabaseClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import type { UserProfile, PermissionKey } from "@/lib/types"

const RATE_LIMIT_WINDOW = 60_000
const RATE_LIMIT_MAX = 20
const requestCounts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = requestCounts.get(ip)

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return false
  }

  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

/**
 * Prüft ob der aktuelle Benutzer authentifiziert ist und eine bestimmte
 * Feature-Berechtigung hat.
 *
 * - Admins haben alle Berechtigungen implizit
 * - Betrachter benötigen einen expliziten Eintrag in user_permissions
 *
 * Gibt entweder das Profil zurück oder eine Fehler-Response.
 */
export async function requirePermission(
  permission: PermissionKey
): Promise<
  | { profile: UserProfile; error?: never }
  | { profile?: never; error: NextResponse }
> {
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown"

  if (isRateLimited(ip)) {
    return {
      error: NextResponse.json(
        { error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." },
        { status: 429 }
      ),
    }
  }

  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Nicht authentifiziert." },
        { status: 401 }
      ),
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, email, role, created_at")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    return {
      error: NextResponse.json(
        { error: "Profil nicht gefunden." },
        { status: 404 }
      ),
    }
  }

  // Admins haben immer alle Berechtigungen
  if (profile.role === "admin") {
    return { profile: profile as UserProfile }
  }

  // Betrachter: Berechtigung in user_permissions prüfen
  const { data: permissions, error: permError } = await supabase
    .from("user_permissions")
    .select("edit_transactions, export_excel, import_statements")
    .eq("user_id", user.id)
    .single()

  if (permError || !permissions || (permissions as Record<string, boolean>)[permission] !== true) {
    return {
      error: NextResponse.json(
        { error: "Keine Berechtigung für diese Aktion." },
        { status: 403 }
      ),
    }
  }

  return { profile: profile as UserProfile }
}
