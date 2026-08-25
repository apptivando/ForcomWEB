/**
 * Normalización de teléfonos argentinos.
 *
 * Vivía como función local dentro de `src/app/api/contact/route.ts`. Se movió
 * acá porque ahora la necesitan tres lugares: el formulario de contacto, el
 * scraper de prospectos (`src/lib/prospects/*`) y el extractor de contactos de
 * sitios web.
 *
 * Al moverla se corrigió un problema que no importaba mientras la única fuente
 * era el formulario: la versión anterior forzaba SIEMPRE el prefijo de celular
 * (`549`). Con datos de Google Places eso está mal — Places devuelve tanto
 * celulares (`+54 9 351 518-1882`) como fijos (`+54 351 428-1234`), y
 * prefijarle el `9` a un fijo fabrica un número de celular que no existe. Por
 * eso ahora hay dos funciones distintas:
 *
 *   - `toE164Ar`         → el número REAL, respetando fijo vs celular.
 *   - `toWhatsappNumber` → el formato que espera WhatsApp (`549…`), que solo
 *                          se usa cuando ya sabemos que el número es de WhatsApp.
 *
 * LECCIÓN QUE SE MANTIENE (no volver a intentarlo): nada de esto trata de
 * detectar y sacar el viejo prefijo local "15" (ej. "011 15-1234-5678"). Se
 * probó y se revirtió: en la costumbre argentina actual (área + número directo,
 * ej. `3515181882`) el "15" aparece tan seguido *por coincidencia* en el borde
 * entre área y abonado — área `351` + abonado que arranca en `5` arma un "15"
 * ahí que no es el prefijo — que rompía números válidos más seguido de lo que
 * arreglaba. Un número escrito con el "15" explícito queda con 11 dígitos
 * significativos, no pasa la validación y devuelve `null`: falla segura, que es
 * mejor que devolver un número corrompido.
 *
 * Formato de salida: dígitos pelados, SIN `+`. Es el formato que ya usa
 * `crm_contacts.phone` y el que espera `toNumber()` de `src/lib/evolution.ts`.
 * (La versión vieja devolvía `+549…` y por eso `contact_messages.phone` y
 * `crm_contacts.phone` guardaban formatos distintos; la migración 010 normaliza
 * las filas viejas.)
 */

/** Solo dígitos: saca `+`, espacios, guiones, paréntesis, puntos. */
export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Los dos primeros dígitos con los que puede empezar un código de área
 * argentino, además del `11` del AMBA.
 *
 * POR QUÉ SOLO DOS DÍGITOS
 * Las áreas argentinas son de 2, 3 o 4 dígitos y la lista completa de las de 4
 * pasa las trescientas entradas. Una lista incompleta sería peor que ninguna:
 * rechazaría números buenos, que es el error caro. Los dos primeros dígitos, en
 * cambio, son un conjunto chico y cerrado — cubre todas las áreas reales sin
 * excepciones — y alcanza para tirar la basura.
 *
 * Lo encontró una medición: un prospecto salió con `+54 321 322-5899`, y el
 * `32` no existe como comienzo de área en ninguna parte del país. El chequeo
 * anterior (`^(11|[23])`) lo dejaba pasar porque empieza con 3.
 */
const AR_AREA_PREFIXES = new Set([
  // Buenos Aires provincia, La Pampa, Patagonia, Cuyo.
  "22", "23", "24", "26", "28", "29",
  // Litoral, Centro, NEA y NOA.
  "33", "34", "35", "36", "37", "38",
]);

/**
 * ¿Es un número nacional significativo argentino válido?
 * Son exactamente 10 dígitos (código de área de 2 a 4 + abonado), y el área
 * es `11` (AMBA) o empieza con uno de los prefijos reales de arriba.
 */
export function isValidArNational(digits: string): boolean {
  if (digits.length !== 10) return false;
  if (/^(\d)\1{9}$/.test(digits)) return false; // 1111111111 y compañía
  if (digits.startsWith("11")) return true;
  return AR_AREA_PREFIXES.has(digits.slice(0, 2));
}

/**
 * ¿Esta corrida de dígitos es un CUIT/CUIL y no un teléfono?
 * Es el falso positivo número uno al extraer teléfonos de sitios argentinos:
 * el CUIT está en el pie de página de prácticamente cualquier comercio, tiene
 * 11 dígitos y los separadores lo hacen parecer un teléfono largo.
 */
export function looksLikeCuit(digits: string): boolean {
  return digits.length === 11 && /^(20|23|24|27|30|33|34)/.test(digits);
}

/**
 * ¿Es un CBU (22) o un DNI suelto (7-8)? Ninguno de los dos es un teléfono.
 * Los DNI aparecen en textos legales y los CBU en las páginas de "cómo pagar".
 */
export function looksLikeCbuOrDni(digits: string): boolean {
  return digits.length === 22 || (digits.length >= 7 && digits.length <= 8);
}

/**
 * Reduce cualquier forma de escribir un teléfono argentino a su número
 * nacional significativo de 10 dígitos, e informa si la fuente lo marcó como
 * celular. Devuelve `null` ante cualquier duda.
 *
 * El marcador de celular es el `9` que va después del código de país en el
 * formato internacional (`+54 9 351 …`). Es la única señal confiable que
 * tenemos: NO se puede deducir de un código de área, porque el mismo área
 * atiende fijos y celulares.
 */
function toNationalAr(raw: string): { national: string; mobileMarker: boolean } | null {
  let d = digitsOnly(raw);
  if (!d) return null;

  if (d.startsWith("00")) d = d.slice(2); // prefijo internacional escrito a mano
  if (d.startsWith("54")) d = d.slice(2); // código de país

  // El `9` solo puede ser el marcador de celular: ningún área argentina
  // arranca en 9, así que si sobran dígitos y empieza en 9, es el marcador.
  let mobileMarker = false;
  if (d.startsWith("9") && d.length > 10) {
    mobileMarker = true;
    d = d.slice(1);
  }

  if (d.startsWith("0")) d = d.slice(1); // prefijo nacional de larga distancia

  return isValidArNational(d) ? { national: d, mobileMarker } : null;
}

/**
 * E.164 argentino real, en dígitos sin `+`, respetando fijo vs celular.
 * Pensada para `internationalPhoneNumber` de Google Places.
 *
 *   "+54 9 351 518-1882" → { e164: "5493515181882", isMobile: true  }
 *   "+54 351 428-1234"   → { e164: "543514281234",  isMobile: false }
 *   "3515181882"         → { e164: "543515181882",  isMobile: false }
 *
 * Ojo con el último caso: cuando la fuente no trae el `9`, NO lo inventamos.
 * `isMobile: false` significa "la fuente no dice que sea celular", no "es fijo".
 */
export function toE164Ar(raw: string): { e164: string; isMobile: boolean } | null {
  const parsed = toNationalAr(raw);
  if (!parsed) return null;
  return {
    e164: parsed.mobileMarker ? `549${parsed.national}` : `54${parsed.national}`,
    isMobile: parsed.mobileMarker,
  };
}

/**
 * Formato que espera WhatsApp: `549` + área + abonado, en dígitos sin `+`.
 * Es el mismo que guarda `crm_contacts.phone` y el que consume
 * `sendText()` de `src/lib/evolution.ts`.
 *
 * Solo usarla cuando ya sabemos que el número es de WhatsApp (salió de un
 * enlace `wa.me`, de un texto que dice "WhatsApp", o lo cargó alguien a mano).
 * Para un teléfono de Google Places sin más evidencia va `toE164Ar`.
 *
 * Cambio respecto de la versión que vivía en `api/contact/route.ts`: además de
 * devolver sin `+`, ahora exige exactamente 10 dígitos nacionales. La anterior
 * aceptaba de 9 a 11, o sea que dejaba pasar números incompletos y números
 * escritos con el "15" explícito. Rechazarlos es la falla segura que el
 * comentario original decía buscar.
 */
export function toWhatsappNumber(raw: string): string | null {
  const parsed = toNationalAr(raw);
  return parsed ? `549${parsed.national}` : null;
}

/** Presentación humana: `+54 9 351 518-1882`. Para la UI, nunca para la DB. */
export function formatArPhone(e164: string): string {
  const d = digitsOnly(e164);
  const parsed = toNationalAr(d);
  if (!parsed) return e164;
  const { national, mobileMarker } = parsed;
  // Área: 11 → 2 dígitos, 2xx/3xx → 3 o 4. Sin lista completa no hay forma
  // exacta, así que se usa la partición más común y se acepta el error visual.
  const areaLen = national.startsWith("11") ? 2 : 3;
  const area = national.slice(0, areaLen);
  const rest = national.slice(areaLen);
  const mid = rest.slice(0, rest.length - 4);
  const end = rest.slice(-4);
  return `+54 ${mobileMarker ? "9 " : ""}${area} ${mid}-${end}`;
}
