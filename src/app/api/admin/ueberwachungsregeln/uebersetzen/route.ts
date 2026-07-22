import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { decrypt } from "@/lib/encryption"
import { uebersetzeUeberwachungsregel } from "@/lib/ki-parser"
import { uebersetzenRequestSchema } from "@/lib/validations/ueberwachungsregeln"
import type { KiProvider } from "@/lib/types"

/**
 * POST /api/admin/ueberwachungsregeln/uebersetzen
 *
 * PROJ-18: Schickt einen Freitext an die konfigurierte KI und gibt die
 * strukturierte Regel-Vorschau (inkl. Klartext-Zusammenfassung) zurück.
 * Es wird noch NICHTS gespeichert — der Admin bestätigt separat über POST.
 *
 * Nur Admins.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { error: "Ungültiger Request-Body." },
        { status: 400 }
      )
    }

    const validation = uebersetzenRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 }
      )
    }

    // KI-Einstellungen laden (analog PDF-Import).
    const adminClient = createAdminSupabaseClient()
    const { data: settings } = await adminClient
      .from("app_settings")
      .select("key, value")
      .in("key", ["ki_provider", "ki_token"])
      .limit(2)

    const providerSetting = settings?.find((s) => s.key === "ki_provider")
    const tokenSetting = settings?.find((s) => s.key === "ki_token")

    if (!tokenSetting?.value) {
      return NextResponse.json(
        {
          error:
            "Kein KI-Token konfiguriert. Bitte hinterlege in den Einstellungen einen KI-Anbieter und Token.",
          code: "kein_ki_token",
        },
        { status: 400 }
      )
    }

    let apiToken: string
    try {
      apiToken = decrypt(tokenSetting.value)
    } catch {
      return NextResponse.json(
        { error: "KI-Token konnte nicht entschlüsselt werden." },
        { status: 500 }
      )
    }

    const provider = (providerSetting?.value || "openai") as KiProvider

    let vorschlag
    try {
      vorschlag = await uebersetzeUeberwachungsregel(
        validation.data.freitext,
        provider,
        apiToken
      )
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Die Regel konnte nicht übersetzt werden."
      // Benutzerfreundliche Meldung (keine KI-Rohausgaben).
      return NextResponse.json({ error: message }, { status: 422 })
    }

    return NextResponse.json({ vorschlag })
  } catch (err) {
    console.error(
      "POST /api/admin/ueberwachungsregeln/uebersetzen Fehler:",
      err
    )
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
