import { createServerSupabaseClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import type { UserProfile } from "@/lib/types"

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
 * Prüft ob der aktuelle Benutzer authentifiziert und Admin ist.
 * Gibt entweder das Admin-Profil zurück oder eine Fehler-Response.
 */
export async function requireAdmin(): Promise<
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

  if (profile.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Keine Berechtigung. Nur Administratoren haben Zugriff." },
        { status: 403 }
      ),
    }
  }

  return { profile: profile as UserProfile }
}

/**
 * Erlaubt Zugriff für Administratoren ODER Benutzer, die im
 * antrag_genehmiger-Pool eingetragen sind. Wird für Lese-Endpunkte rund um
 * Kostenübernahme-Anträge verwendet.
 */
export async function requireAdminOrAntragGenehmiger(): Promise<
  | { profile: UserProfile; isAdmin: boolean; error?: never }
  | { profile?: never; isAdmin?: never; error: NextResponse }
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

  const isAdmin = profile.role === "admin"

  if (!isAdmin) {
    const { data: poolEntry } = await supabase
      .from("antrag_genehmiger")
      .select("user_id")
      .eq("user_id", profile.id)
      .maybeSingle()

    if (!poolEntry) {
      return {
        error: NextResponse.json(
          {
            error:
              "Keine Berechtigung. Nur Administratoren oder Antrag-Genehmiger haben Zugriff.",
          },
          { status: 403 }
        ),
      }
    }
  }

  return { profile: profile as UserProfile, isAdmin }
}
