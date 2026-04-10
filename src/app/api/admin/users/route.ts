import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

// GET: Alle Benutzer mit Auth-Daten laden
export async function GET() {
  const authResult = await requireAdmin()
  if (authResult.error) {
    return authResult.error
  }

  const adminClient = createAdminSupabaseClient()

  // 1. Profile aus der Datenbank laden
  const { data: profiles, error: profilesError } = await adminClient
    .from("user_profiles")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: true })
    .limit(100)

  if (profilesError) {
    return NextResponse.json(
      { error: "Benutzer konnten nicht geladen werden." },
      { status: 500 }
    )
  }

  // 2. Auth-Benutzer laden um last_sign_in_at zu erhalten
  const { data: authData, error: authError } =
    await adminClient.auth.admin.listUsers({ perPage: 100 })

  if (authError) {
    // Fallback: Profile ohne last_sign_in_at zurückgeben
    return NextResponse.json(
      profiles.map((p) => ({ ...p, last_sign_in_at: null }))
    )
  }

  // 3. Auth-Daten mit Profilen zusammenfuehren
  const authMap = new Map(
    authData.users.map((u) => [u.id, u.last_sign_in_at])
  )

  const users = profiles.map((p) => ({
    ...p,
    last_sign_in_at: authMap.get(p.id) ?? null,
  }))

  return NextResponse.json(users)
}
