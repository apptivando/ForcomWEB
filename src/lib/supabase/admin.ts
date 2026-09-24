import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con la service role key — bypasea RLS. Server-only: nunca
// importar desde un componente cliente ni exponer SUPABASE_SERVICE_KEY
// al bundle del browser. Uso: invitar usuarios via Supabase Auth Admin
// API (crear usuarios, setear contraseñas, listar por email), que la clave
// anon no puede hacer.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Cliente anon suelto, sin cookies ni sesión persistida. Sirve para probar
 * credenciales (¿esta contraseña es la de este usuario?) sin pisar la sesión
 * del navegador que está haciendo el pedido — que es lo que pasaría usando el
 * cliente de `lib/supabase/server`.
 */
export function createCredentialsClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Busca un usuario de Supabase Auth por email. La Admin API v2 no tiene un
 * `getUserByEmail`, así que se lista y se filtra acá — el panel tiene unos
 * pocos usuarios, no hace falta paginar.
 */
export async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
) {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(error.message);
  return data.users.find((u) => u.email?.toLowerCase() === normalized) ?? null;
}
