import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"
import { fuehreBankAbrufAus } from "@/lib/psd2/sync"

/**
 * POST /api/admin/psd2/sync
 * Manueller Bank-Abruf-Trigger (nur Admin).
 */
export async function POST() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const adminClient = createAdminSupabaseClient()

  try {
    const ergebnis = await fuehreBankAbrufAus(adminClient)
    const httpStatus = ergebnis.abrufStatus === "fehler" ? 502 : 200
    return NextResponse.json(ergebnis, { status: httpStatus })
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Abruf fehlgeschlagen: ${err.message}`
            : "Unbekannter Fehler beim Abruf.",
      },
      { status: 500 }
    )
  }
}
