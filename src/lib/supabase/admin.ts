import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con la service role key — bypasea RLS. Server-only: nunca
// importar desde un componente cliente ni exponer SUPABASE_SERVICE_KEY
// al bundle del browser. Uso: invitar usuarios via Supabase Auth Admin
// API (auth.admin.inviteUserByEmail), que la clave anon no puede hacer.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
