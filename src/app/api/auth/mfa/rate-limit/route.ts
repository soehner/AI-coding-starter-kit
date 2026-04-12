import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { rateLimitActionSchema } from "@/lib/validations/mfa"

const MAX_VERSUCHE = 5
const SPERR_DAUER_MS = 15 * 60 * 1000 // 15 Minuten

/**
 * POST /api/auth/mfa/rate-limit
 * Verwaltet Rate-Limiting für 2FA-Code-Eingabe.
 *
 * Aktionen:
 * - "check": Prüft ob der Benutzer gesperrt ist
 * - "fail": Zählt einen Fehlversuch hoch
 * - "reset": Setzt die Fehlversuche zurück (nach erfolgreicher Anmeldung)
 */
export async function POST(request: Request) {
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown"

  // Benutzer-Session prüfen
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert." },
      { status: 401 }
    )
  }

  // Eingabe validieren
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 }
    )
  }

  const parsed = rateLimitActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Ungültige Eingabe." },
      { status: 400 }
    )
  }

  const { action } = parsed.data
  const adminSupabase = createAdminSupabaseClient()

  // Bestehenden Rate-Limit-Eintrag laden
  const { data: existing } = await adminSupabase
    .from("mfa_rate_limits")
    .select("*")
    .eq("user_id", user.id)
    .eq("ip_address", ip)
    .single()

  if (action === "check") {
    // Prüfen ob gesperrt
    if (existing?.gesperrt_bis) {
      const gesperrtBis = new Date(existing.gesperrt_bis)
      if (new Date() < gesperrtBis) {
        return NextResponse.json(
          {
            gesperrt: true,
            gesperrtBis: gesperrtBis.toISOString(),
            fehlversuche: existing.fehlversuche,
          },
          { status: 429 }
        )
      }
      // Sperre ist abgelaufen – zurücksetzen
      await adminSupabase
        .from("mfa_rate_limits")
        .update({
          fehlversuche: 0,
          gesperrt_bis: null,
          zuletzt_versucht_am: new Date().toISOString(),
        })
        .eq("id", existing.id)
    }

    return NextResponse.json({
      gesperrt: false,
      fehlversuche: existing?.fehlversuche ?? 0,
    })
  }

  if (action === "fail") {
    const neueFehlversuche = (existing?.fehlversuche ?? 0) + 1
    const jetzt = new Date().toISOString()

    // Sperrung setzen wenn Maximum erreicht
    const gesperrtBis =
      neueFehlversuche >= MAX_VERSUCHE
        ? new Date(Date.now() + SPERR_DAUER_MS).toISOString()
        : null

    if (existing) {
      await adminSupabase
        .from("mfa_rate_limits")
        .update({
          fehlversuche: neueFehlversuche,
          gesperrt_bis: gesperrtBis,
          zuletzt_versucht_am: jetzt,
        })
        .eq("id", existing.id)
    } else {
      await adminSupabase.from("mfa_rate_limits").insert({
        user_id: user.id,
        ip_address: ip,
        fehlversuche: neueFehlversuche,
        gesperrt_bis: gesperrtBis,
        zuletzt_versucht_am: jetzt,
      })
    }

    if (gesperrtBis) {
      return NextResponse.json(
        {
          gesperrt: true,
          gesperrtBis,
          fehlversuche: neueFehlversuche,
        },
        { status: 429 }
      )
    }

    return NextResponse.json({
      gesperrt: false,
      fehlversuche: neueFehlversuche,
      verbleibendeVersuche: MAX_VERSUCHE - neueFehlversuche,
    })
  }

  if (action === "reset") {
    if (existing) {
      await adminSupabase
        .from("mfa_rate_limits")
        .update({
          fehlversuche: 0,
          gesperrt_bis: null,
          zuletzt_versucht_am: new Date().toISOString(),
        })
        .eq("id", existing.id)
    }

    return NextResponse.json({ gesperrt: false, fehlversuche: 0 })
  }

  return NextResponse.json(
    { error: "Ungültige Aktion." },
    { status: 400 }
  )
}
