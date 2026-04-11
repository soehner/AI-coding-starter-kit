import { createServerSupabaseClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"
import { headers } from "next/headers"

const RATE_LIMIT_WINDOW = 60_000
const RATE_LIMIT_MAX = 30
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

export async function GET() {
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown"

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." },
      { status: 429 }
    )
  }

  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, email, role, created_at, user_permissions(edit_transactions, export_excel, import_statements)")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Profil nicht gefunden" },
      { status: 404 }
    )
  }

  // Berechtigungen flach mappen: Admins haben implizit alles
  const isAdmin = profile.role === "admin"
  // Supabase gibt bei 1:n-Joins ein Array zurück, bei 1:1 mit .single() ein Objekt oder Array
  const rawPermissions = profile.user_permissions
  const permissions = Array.isArray(rawPermissions) ? rawPermissions[0] : rawPermissions
  const perms = permissions as { edit_transactions?: boolean; export_excel?: boolean; import_statements?: boolean } | null
  const response = {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    created_at: profile.created_at,
    permissions: {
      edit_transactions: isAdmin || perms?.edit_transactions === true,
      export_excel: isAdmin || perms?.export_excel === true,
      import_statements: isAdmin || perms?.import_statements === true,
    },
  }

  return NextResponse.json(response)
}
