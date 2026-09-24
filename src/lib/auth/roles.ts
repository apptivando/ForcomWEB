import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminRole = "owner" | "admin" | "agent";

/** Nombre visible de cada rol. Se usa en el panel y en los correos. */
export const ROLE_LABEL: Record<AdminRole, string> = {
  owner: "Dueño",
  admin: "Admin",
  agent: "Agente",
};

const ROLE_RANK: Record<AdminRole, number> = {
  agent: 0,
  admin: 1,
  owner: 2,
};

export function hasMinRole(role: AdminRole | null, min: AdminRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/**
 * Rol del usuario logueado, o null si no es miembro del admin (no
 * debería pasar si ya cruzó el gate de src/proxy.ts, pero una Server
 * Action puede llamarse igual sin pasar por ahí).
 */
export async function getCurrentRole(
  supabase: SupabaseClient
): Promise<AdminRole | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("admin_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  return (data?.role as AdminRole | undefined) ?? null;
}

/**
 * Server Action guard: exige que el usuario logueado tenga al menos
 * `min` rol. Tira si no hay sesión o el rol no alcanza — RLS es la
 * última línea de defensa, esto da un error legible antes de llegar
 * ahí.
 */
export async function requireRole(
  supabase: SupabaseClient,
  min: AdminRole = "agent"
): Promise<AdminRole> {
  const role = await getCurrentRole(supabase);
  if (!hasMinRole(role, min)) throw new Error("No autorizado");
  return role!;
}
