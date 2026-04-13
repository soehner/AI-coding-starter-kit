import { NextResponse } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { fuehreBankAbrufAus } from "@/lib/psd2/sync"

/**
 * GET/POST /api/cron/psd2-abruf
 *
 * Taeglich von Vercel Cron aufgerufen. Schutz via CRON_SECRET-Header.
 * Kein Session-Schutz — dieser Endpunkt ist in publicRoutes der Middleware
 * eingetragen.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET ist nicht konfiguriert." },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  if (authHeader !== expected) {
    return NextResponse.json(
      { error: "Nicht autorisiert." },
      { status: 401 }
    )
  }

  const adminClient = createAdminSupabaseClient()
  try {
    const ergebnis = await fuehreBankAbrufAus(adminClient)
    return NextResponse.json(ergebnis)
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Cron-Fehler: ${err.message}`
            : "Unbekannter Fehler im Cron-Lauf.",
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
