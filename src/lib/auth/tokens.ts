/**
 * Tokens de un solo uso que viajan por correo (invitaciones, recuperación de
 * contraseña).
 *
 * La regla, igual para todos: en la base va el hash, nunca el token. El token
 * en claro existe solo en el mail. Si alguien lee la tabla no puede fabricarse
 * un link, y si el token se pierde no se recupera — se emite otro.
 *
 * Server-only.
 */

import { createHash, randomBytes } from "crypto";

/** 32 bytes al azar. En base64url son 43 caracteres, seguros para una URL. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Largo mínimo plausible: descarta basura antes de ir a la base. */
export const MIN_TOKEN_LENGTH = 20;

export function tokenExpiry(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}
