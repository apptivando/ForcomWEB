/**
 * Defensa anti-bot del formulario público, sin CAPTCHA.
 *
 * Entraron dos envíos con razón social y nombre de contacto generados al azar
 * —cadenas de letras sin sentido— que además de ensuciar el contador del
 * dashboard se propagaron a la base de clientes. El formulario no tenía
 * ninguna protección.
 *
 * Dos comprobaciones baratas que atajan la mayoría del spam automatizado y no
 * le agregan un solo clic a una persona real:
 *
 * 1. **Honeypot**: un campo que el usuario no ve ni puede tabular. Los bots
 *    completan todo lo que encuentran en el DOM; una persona no puede.
 * 2. **Tiempo mínimo de llenado**: un bot postea en milisegundos. Escribir
 *    nombre, email y una consulta lleva bastante más que el umbral.
 *
 * A propósito **no se le dice al bot que fue rechazado**: la respuesta es la
 * misma que la de un envío bueno. Un mensaje de error es justo la señal que
 * necesitaría para ajustar el ataque.
 */

/**
 * Nombre del campo trampa.
 *
 * A propósito **no** es "website", "url", "empresa" ni nada que el
 * autocompletado del navegador o un gestor de contraseñas pueda reconocer: si
 * lo llenaran solos, el mensaje de una persona real se descartaría en silencio
 * y ella vería "Mensaje enviado". Ese es el modo de fallo peligroso de un
 * honeypot, y es peor que dejar pasar spam.
 *
 * Que el nombre no le "suene" a un bot no importa: los bots completan todos
 * los campos de texto que encuentran en el DOM, no los que entienden.
 */
export const HONEYPOT_FIELD = "fc_ref";

/**
 * Piso de tiempo entre que se pinta el formulario y que se envía.
 * Tres segundos: por debajo de lo que tarda cualquier persona en completar
 * tres campos, y muy por encima de lo que tarda un script.
 */
export const MIN_FILL_MS = 3000;

/** Motivo del descarte, o null si el envío parece legítimo. */
export function spamReason(payload: Record<string, unknown>): string | null {
  const honeypot = payload[HONEYPOT_FIELD];
  if (typeof honeypot === "string" && honeypot.trim() !== "") return "honeypot";

  const elapsed = Number(payload.elapsedMs);
  // Un `elapsedMs` ausente o no numérico también es sospechoso: el formulario
  // real siempre lo manda. Se descarta.
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) return "too-fast";

  return null;
}
