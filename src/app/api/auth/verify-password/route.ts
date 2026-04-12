import { createServerSupabaseClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"

const verifyPasswordSchema = z.object({
  password: z.string().min(1, "Passwort ist erforderlich."),
})

/**
 * POST /api/auth/verify-password
 * Verifiziert das Passwort des aktuellen Benutzers, ohne die Session zu verändern.
 * Wird z.B. beim Deaktivieren von 2FA verwendet.
 */
export async function POST(request: Request) {
  // Aktuelle Session prüfen
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.email) {
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

  const parsed = verifyPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Ungültige Eingabe." },
      { status: 400 }
    )
  }

  // Passwort prüfen mit einem separaten Client (beeinflusst die aktive Session nicht)
  const tempClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  const { error: signInError } = await tempClient.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.password,
  })

  if (signInError) {
    return NextResponse.json(
      { error: "Falsches Passwort." },
      { status: 401 }
    )
  }

  return NextResponse.json({ success: true })
}
