import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Cliente de servicio (server-side only). Supabase actúa como caché de métricas:
// /api/sync escribe, el dashboard lee. Nunca exponer esta key al navegador.
let client: SupabaseClient | null = null

export function getDb(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
  }
  return client
}
