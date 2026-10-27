import type { Product } from "@/lib/types";

/**
 * Qué le falta a un producto para poder salir al sitio público.
 *
 * Existe porque el panel dejaba crear un producto con solo Modelo y Categoría,
 * lo guardaba activo y con `order_index` 0 —o sea primero en la lista— y en el
 * sitio aparecía una tarjeta sin foto y sin datos. Nadie se enteraba. Es el
 * mismo mecanismo que publicó el texto "→ Completar specs desde catálogo
 * pág. 9-10 ←" en forcom.tech.
 *
 * Lo usan el formulario (para avisar antes de activar) y el listado (para
 * mostrar qué falta sin tener que abrir cada ficha).
 */

/**
 * Marcas de contenido a medio cargar que nunca deberían llegar al sitio.
 *
 * Van en dos expresiones y no en una, por una razón que costó un falso
 * positivo sobre 8 de los 18 productos:
 *
 * `TODO` tiene que ser SENSIBLE A MAYÚSCULAS. Con la bandera `i`, `\bTODO\b`
 * matchea la palabra española "todo" —"pantalla todo en uno"— y, peor, matchea
 * DENTRO de "Método": en JS `\w` es solo `[A-Za-z0-9_]`, así que la "é" no es
 * carácter de palabra y queda un límite `\b` justo antes de "todo". Ocho fichas
 * perfectamente cargadas aparecían marcadas como incompletas.
 */
const PLACEHOLDER_I = /\b(completar|lorem ipsum|pendiente de carga)\b|\bpág\.\s*\d/i;
const PLACEHOLDER_TODO = /\bTODO\b/;

function looksUnfinished(text: string): boolean {
  return PLACEHOLDER_I.test(text) || PLACEHOLDER_TODO.test(text);
}

export type ProductGap = "imágenes" | "descripción" | "especificaciones" | "specs de tarjeta";

/** Campos de producto que alcanzan para evaluar completitud. */
export type CompletenessInput = Pick<
  Product,
  "images" | "image_url" | "description" | "full_specs" | "specs"
>;

export function productGaps(p: CompletenessInput): ProductGap[] {
  const gaps: ProductGap[] = [];
  const hasImage = (p.images?.filter(Boolean).length ?? 0) > 0 || !!p.image_url;
  if (!hasImage) gaps.push("imágenes");
  if (!p.description?.trim()) gaps.push("descripción");
  if (!p.full_specs?.trim()) gaps.push("especificaciones");
  if ((p.specs?.filter((s) => s.trim()).length ?? 0) === 0) gaps.push("specs de tarjeta");
  return gaps;
}

/**
 * Textos que delatan contenido a medio cargar. Separado de `productGaps`
 * porque un campo lleno con "Completar specs desde catálogo" es peor que un
 * campo vacío: el vacío no se publica, ese texto sí.
 */
export function placeholderFields(p: CompletenessInput): string[] {
  const found: string[] = [];
  if (p.description && looksUnfinished(p.description)) found.push("la descripción");
  if (p.full_specs && looksUnfinished(p.full_specs)) found.push("las especificaciones");
  if (p.specs?.some((s) => looksUnfinished(s))) found.push("las specs de tarjeta");
  return found;
}

function listaEs(items: string[], nexo: "ni" | "y"): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} ${nexo} ${items[items.length - 1]}`;
}

/** Resumen en una línea de por qué no conviene publicarlo todavía. */
export function whyNotReady(p: CompletenessInput): string | null {
  const gaps = productGaps(p);
  const placeholders = placeholderFields(p);
  if (!gaps.length && !placeholders.length) return null;
  const parts: string[] = [];
  if (gaps.length) parts.push(`no tiene ${listaEs(gaps, "ni")}`);
  if (placeholders.length) {
    parts.push(`quedó texto a completar en ${listaEs(placeholders, "y")}`);
  }
  return parts.join(", y ");
}
