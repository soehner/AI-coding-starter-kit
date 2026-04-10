import { createClient } from "@supabase/supabase-js"

/**
 * Erstellt einen Supabase-Admin-Client mit Service-Role-Key.
 * NUR serverseitig verwenden (API-Routen).
 * Umgeht RLS - daher nur fuer Admin-Operationen einsetzen.
 */
export function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase Admin-Umgebungsvariablen fehlen. NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein."
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
