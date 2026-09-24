/**
 * Invitaciones al panel: emisión y validación del token.
 *
 * Lo importante: abrir el link NO consume nada. La validación de acá es de
 * lectura pura; el token recién se marca como usado cuando la persona manda la
 * contraseña. Por eso los escáneres de seguridad de las casillas corporativas,
 * que abren los links antes de entregar el mail, ya no rompen la invitación
 * (era el bug del flujo de Supabase — ver docs/ACCESOS.md).
 *
 * El manejo del token en sí está en `tokens.ts`, compartido con la
 * recuperación de contraseña.
 *
 * Server-only: usa la service role key.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, tokenExpiry, MIN_TOKEN_LENGTH } from "@/lib/auth/tokens";
import type { AdminRole } from "@/lib/auth/roles";

/** Días que dura una invitación desde que se emite. */
export const INVITATION_TTL_DAYS = 7;

export function invitationExpiry(): string {
  return tokenExpiry(INVITATION_TTL_DAYS * 24 * 60);
}

export function invitationUrl(origin: string, token: string): string {
  return `${origin}/admin/join?token=${encodeURIComponent(token)}`;
}

export type InvitationLookup =
  | { status: "ok"; id: string; email: string; role: AdminRole; expiresAt: string }
  | { status: "expired"; email: string }
  | { status: "used"; email: string }
  | { status: "invalid" };

/**
 * Busca la invitación de un token sin consumirla. Distingue los motivos de
 * rechazo para que /admin/join pueda decir algo útil en vez de "link inválido".
 */
export async function lookupInvitation(token: string): Promise<InvitationLookup> {
  if (!token || token.length < MIN_TOKEN_LENGTH) return { status: "invalid" };

  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_invitations")
    .select("id, email, role, expires_at, accepted_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!data) return { status: "invalid" };
  if (data.accepted_at) return { status: "used", email: data.email };
  if (new Date(data.expires_at) < new Date()) {
    return { status: "expired", email: data.email };
  }

  return {
    status: "ok",
    id: data.id,
    email: data.email,
    role: data.role as AdminRole,
    expiresAt: data.expires_at,
  };
}
