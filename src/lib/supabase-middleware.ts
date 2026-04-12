import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

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
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Routen ohne Login-Pflicht
  const publicRoutes = ["/login", "/passwort-vergessen", "/api/auth/callback", "/auth/confirm", "/antrag", "/abstimmung", "/api/cost-requests"]
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  )

  // Auth-Routen: Eingeloggte Benutzer → Dashboard (Login/Passwort-vergessen nicht nötig)
  const authOnlyRoutes = ["/login", "/passwort-vergessen", "/api/auth/callback"]
  const isAuthOnlyRoute = authOnlyRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  )

  // MFA-bezogene Routen: Zugriff mit AAL1 erlaubt (wird für 2FA-Verifizierung benötigt)
  const mfaRoutes = ["/mfa-verifizierung", "/api/auth/mfa"]
  const isMfaRoute = mfaRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  )

  // Nicht eingeloggt und auf geschützter Route → Redirect zu /login
  if (!user && !isPublicRoute && !isMfaRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Eingeloggt und auf Auth-Route → Redirect zu /dashboard
  if (user && isAuthOnlyRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // AAL-Level prüfen: Benutzer mit 2FA müssen AAL2 haben oder Backup-Cookie
  if (user && !isPublicRoute && !isMfaRoute && !isAuthOnlyRoute) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    if (aalData && aalData.currentLevel === "aal1" && aalData.nextLevel === "aal2") {
      // Benutzer hat 2FA aktiviert, aber nur AAL1 (MFA noch nicht abgeschlossen)
      // Prüfe ob ein gültiger Backup-Code-Cookie existiert
      const backupCookie = request.cookies.get("mfa_backup_verified")?.value
      if (!backupCookie || !await verifyMfaBackupCookie(backupCookie, user.id)) {
        const url = request.nextUrl.clone()
        url.pathname = "/mfa-verifizierung"
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

/**
 * Verifiziert das MFA-Backup-Cookie (HMAC-signiert).
 * Format: base64(userId:timestamp).hmacHex
 */
async function verifyMfaBackupCookie(cookie: string, userId: string): Promise<boolean> {
  try {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!secret) return false

    const dotIndex = cookie.lastIndexOf(".")
    if (dotIndex === -1) return false

    const payloadB64 = cookie.substring(0, dotIndex)
    const signature = cookie.substring(dotIndex + 1)

    // HMAC verifizieren (Web Crypto API für Edge Runtime)
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
    const expectedSigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64))
    const expectedSig = Array.from(new Uint8Array(expectedSigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    if (signature !== expectedSig) return false

    // Payload dekodieren und prüfen
    const payload = atob(payloadB64)
    const [tokenUserId, timestampStr] = payload.split(":")
    if (tokenUserId !== userId) return false

    // Token nach 24 Stunden ungültig
    const age = Date.now() - parseInt(timestampStr, 10)
    return age < 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}
