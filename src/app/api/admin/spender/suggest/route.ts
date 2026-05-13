import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { createAdminSupabaseClient } from "@/lib/supabase-admin"

const SIMILARITY_THRESHOLD = 0.4
const MAX_VORSCHLAEGE = 5

/**
 * GET /api/admin/spender/suggest?name=<counterpart>&iban=<iban>
 *
 * Liefert Vorschläge für passende Spender beim Öffnen des
 * Quittungs-Erstellungs-Dialogs. Reihenfolge:
 *
 *   1. Exakter IBAN-Treffer (höchste Priorität – das ist sicher derselbe Spender)
 *   2. pg_trgm-Fuzzy-Match auf den Namen (similarity ≥ 0.4)
 *
 * Maximal 5 Vorschläge zur Anzeige im Dialog.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const nameQuery = (searchParams.get("name") || "").trim().slice(0, 200)
  const ibanQuery = (searchParams.get("iban") || "").trim().slice(0, 34)

  if (nameQuery.length === 0 && ibanQuery.length === 0) {
    return NextResponse.json({ vorschlaege: [] })
  }

  const supabase = createAdminSupabaseClient()

  type SpenderRow = {
    id: string
    name: string
    strasse: string | null
    plz: string | null
    ort: string | null
    email: string | null
    iban: string | null
    created_at: string
    updated_at: string
  }

  const vorschlaege: (SpenderRow & { similarity: number })[] = []

  // 1. Exakter IBAN-Treffer (similarity = 1.0)
  if (ibanQuery.length > 0) {
    const { data: ibanMatch, error: ibanError } = await supabase
      .from("spender")
      .select(
        "id, name, strasse, plz, ort, email, iban, created_at, updated_at"
      )
      .eq("iban", ibanQuery)
      .limit(MAX_VORSCHLAEGE)

    if (ibanError) {
      console.error("IBAN-Lookup fehlgeschlagen:", ibanError.message)
    } else if (ibanMatch && ibanMatch.length > 0) {
      for (const row of ibanMatch) {
        vorschlaege.push({ ...row, similarity: 1.0 })
      }
    }
  }

  // 2. Fuzzy-Match auf Namen (per RPC, weil PostgREST kein
  //    SELECT-with-Computed-Column unterstützt)
  if (nameQuery.length > 0) {
    const existingIds = new Set(vorschlaege.map((v) => v.id))

    const { data: fuzzy, error: fuzzyError } = await supabase.rpc(
      "spender_fuzzy_suche",
      {
        p_name: nameQuery,
        p_threshold: SIMILARITY_THRESHOLD,
        p_limit: MAX_VORSCHLAEGE,
      }
    )

    if (fuzzyError && fuzzyError.code !== "PGRST202") {
      // PGRST202 = Funktion existiert nicht – Fallback unten greift dann.
      console.error("Fuzzy-Suche fehlgeschlagen:", fuzzyError.message)
    }

    if (Array.isArray(fuzzy) && fuzzy.length > 0) {
      for (const row of fuzzy as Array<SpenderRow & { similarity: number }>) {
        if (existingIds.has(row.id)) continue
        vorschlaege.push(row)
        existingIds.add(row.id)
        if (vorschlaege.length >= MAX_VORSCHLAEGE) break
      }
    } else {
      // Fallback: Wenn die RPC nicht existiert (alte DB), nutze ein
      // einfaches ilike-%-Match. Reduziert Trefferqualität, hält aber
      // den Endpoint funktional.
      const sanitized = nameQuery.replace(/[%_]/g, "\\$&")
      const { data: ilike } = await supabase
        .from("spender")
        .select(
          "id, name, strasse, plz, ort, email, iban, created_at, updated_at"
        )
        .ilike("name", `%${sanitized}%`)
        .limit(MAX_VORSCHLAEGE)

      for (const row of ilike ?? []) {
        if (existingIds.has(row.id)) continue
        vorschlaege.push({ ...row, similarity: 0.5 })
        existingIds.add(row.id)
        if (vorschlaege.length >= MAX_VORSCHLAEGE) break
      }
    }
  }

  // Sortierung: höchste Ähnlichkeit zuerst
  vorschlaege.sort((a, b) => b.similarity - a.similarity)

  return NextResponse.json({
    vorschlaege: vorschlaege.slice(0, MAX_VORSCHLAEGE),
  })
}
