/**
 * Recuperación de contraseña ("olvidé mi contraseña").
 *
 * Mismo mecanismo que las invitaciones — token propio, hash en la base, se
 * consume con el POST y no al abrir el link — con dos diferencias pensadas
 * para lo que es:
 *
 * - Dura una hora, no una semana. Un link de recuperación vivo es una llave de
 *   la cuenta dando vueltas en una casilla.
 * - No crea nada ni da permisos: solo cambia la contraseña de alguien que ya
 *   es miembro del panel.
 *
 * Server-only: usa la service role key.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, tokenExpiry, MIN_TOKEN_LENGTH } from "@/lib/auth/tokens";

/** Minutos que dura un link de recuperación. */
export const RESET_TTL_MINUTES = 60;

/**
 * Cada cuánto se le puede mandar un correo de recuperación a la misma casilla.
 * Evita que apretar el botón diez veces mande diez correos (y que alguien use
 * el formulario para inundarle la bandeja a otro).
 */
export const RESET_THROTTLE_SECONDS = 60;

export function resetExpiry(): string {
  return tokenExpiry(RESET_TTL_MINUTES);
}

export function resetUrl(origin: string, token: string): string {
  return `${origin}/admin/recuperar?token=${encodeURIComponent(token)}`;
}

export type ResetLookup =
  | { status: "ok"; id: string; userId: string; email: string }
  | { status: "expired" }
  | { status: "used" }
  | { status: "invalid" };

/** Valida un token de recuperación sin consumirlo. */
export async function lookupPasswordReset(token: string): Promise<ResetLookup> {
  if (!token || token.length < MIN_TOKEN_LENGTH) return { status: "invalid" };

  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_password_resets")
    .select("id, user_id, email, expires_at, used_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!data) return { status: "invalid" };
  if (data.used_at) return { status: "used" };
  if (new Date(data.expires_at) < new Date()) return { status: "expired" };

  return { status: "ok", id: data.id, userId: data.user_id, email: data.email };
}
