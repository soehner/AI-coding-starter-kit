import { createAdminSupabaseClient } from "@/lib/supabase-admin"

/**
 * DB-basiertes Rate-Limiting.
 * Ersetzt die bisherige In-Memory-Lösung, die auf Vercel-Serverless bei jedem
 * Cold Start zurückgesetzt wurde.
 *
 * @param key  Eindeutiger Schlüssel, z.B. `${endpoint}:${ip}`
 * @param max  Maximale Anzahl Anfragen innerhalb des Fensters
 * @param windowSeconds  Fensterlänge in Sekunden
 * @returns true, wenn die Grenze überschritten wurde (Request blockieren)
 */
export async function isRateLimited(
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const supabase = createAdminSupabaseClient()

    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_window_seconds: windowSeconds,
    })

    if (error) {
      console.error("Rate-Limit-Prüfung fehlgeschlagen:", error.message)
      // Fail-open: Bei DB-Fehler Request durchlassen, um legitime Nutzer nicht auszusperren
      return false
    }

    const count = typeof data === "number" ? data : 0
    return count > max
  } catch (err) {
    console.error("Rate-Limit-Exception:", err)
    return false
  }
}
