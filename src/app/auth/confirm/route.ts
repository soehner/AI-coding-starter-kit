import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { EmailOtpType } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const defaultNext = type === "invite" ? "/einladung-annehmen" : "/dashboard"
  const next = searchParams.get("next") ?? defaultNext

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Ungültiger oder unvollständiger Bestätigungslink.")}`
    )
  }

  // Response vorab anlegen, damit der Supabase-Client die Session-Cookies
  // direkt auf die Redirect-Response schreiben kann. Sonst würden die Cookies
  // nur im cookieStore landen und bei NextResponse.redirect() verlorengehen.
  let response = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.redirect(`${origin}${next}`)
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  })

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "Der Einladungslink ist ungültig oder abgelaufen. Bitte fordern Sie eine neue Einladung an."
      )}`
    )
  }

  return response
}
