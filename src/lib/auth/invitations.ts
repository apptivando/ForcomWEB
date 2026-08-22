/**
 * Invitaciones al panel: emisión y validación del token propio.
 *
 * El token viaja en el link del correo (`/admin/join?token=…`) y en la base
 * queda solo su hash. Dos consecuencias buscadas:
 *
 * 1. Abrir el link NO consume nada. La validación de acá es de lectura pura;
 *    el token recién se marca como usado cuando la persona manda la
 *    contraseña. Por eso los escáneres de seguridad de las casillas
 *    corporativas, que abren los links antes de entregar el mail, ya no
 *    rompen la invitación (era el bug del flujo de Supabase).
 * 2. Si alguien lee la tabla no puede fabricarse un link: tendría el hash, no
 *    el token.
 *
 * Server-only: usa la service role key.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminRole } from "@/lib/auth/roles";

/** Días que dura una invitación desde que se emite. */
export const INVITATION_TTL_DAYS = 7;

export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationExpiry(): string {
  return new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
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
  if (!token || token.length < 20) return { status: "invalid" };

  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_invitations")
    .select("id, email, role, expires_at, accepted_at")
    .eq("token_hash", hashInvitationToken(token))
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

/**
 * Comparación en tiempo constante de dos hashes hex. La búsqueda por índice ya
 * hace el trabajo, esto es para el chequeo final antes de consumir el token.
 */
export function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashInvitationToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
