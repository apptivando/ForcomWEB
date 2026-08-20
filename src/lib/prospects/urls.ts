/**
 * Clasificación y normalización de URLs.
 *
 * Lo usan dos lugares: la búsqueda de prospectos (para no guardar un perfil de
 * Instagram en la columna `website`) y el enriquecedor (para decidir qué se
 * puede visitar y qué no).
 */

/** Redes que NUNCA se visitan: exigen login y sus términos prohíben scrapearlas. */
const SOCIAL_HOSTS: Array<{ re: RegExp; kind: "instagram" | "facebook" | "linkedin" }> = [
  { re: /(^|\.)instagram\.com$/i, kind: "instagram" },
  { re: /(^|\.)facebook\.com$/i, kind: "facebook" },
  { re: /(^|\.)fb\.com$/i, kind: "facebook" },
  { re: /(^|\.)linkedin\.com$/i, kind: "linkedin" },
];

/** Hosts que son plataformas de terceros, no el dominio propio del comercio. */
const LINK_IN_BIO = /(^|\.)(linktr\.ee|beacons\.ai|bio\.link|linkr\.bio|lnk\.bio)$/i;

export type UrlKind = "web" | "instagram" | "facebook" | "linkedin" | "linkinbio" | "invalid";

export interface ClassifiedUrl {
  kind: UrlKind;
  /** URL normalizada (https, sin fragmento, sin barra final), o null si es inválida. */
  url: string | null;
  host: string | null;
}

/**
 * Normaliza y clasifica una URL.
 *
 * El caso que importa: en Argentina es muy común que el "sitio web" que
 * publica un comercio en Google Maps SEA su Instagram. Guardarlo en `website`
 * haría que el enriquecedor intente crawlear instagram.com, que está prohibido
 * y además devuelve un muro de login. Detectarlo acá lo manda directo al
 * nivel 3 con el perfil ya guardado, que es un resultado mucho mejor.
 */
export function classifyUrl(raw: string | null | undefined): ClassifiedUrl {
  if (!raw?.trim()) return { kind: "invalid", url: null, host: null };

  let parsed: URL;
  try {
    parsed = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return { kind: "invalid", url: null, host: null };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { kind: "invalid", url: null, host: null };
  }

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  parsed.hash = "";
  const url = parsed.toString().replace(/\/$/, "");

  for (const { re, kind } of SOCIAL_HOSTS) {
    if (re.test(host)) return { kind, url, host };
  }
  if (LINK_IN_BIO.test(host)) return { kind: "linkinbio", url, host };

  return { kind: "web", url, host };
}

/**
 * Dominio registrable, aproximado. Sirve para no salirse del sitio del
 * prospecto al seguir links internos.
 *
 * No usa la Public Suffix List (sería una dependencia nueva para muy poco):
 * trata los sufijos compuestos argentinos más comunes como un caso especial y
 * para el resto se queda con los dos últimos tramos. Un error acá solo
 * significa visitar o no visitar una página de más; nunca corrompe datos.
 */
export function registrableDomain(host: string): string {
  const parts = host.replace(/^www\./i, "").toLowerCase().split(".");
  if (parts.length <= 2) return parts.join(".");
  const lastTwo = parts.slice(-2).join(".");
  const COMPOUND = /^(com|net|org|gov|edu|int|mil|tur)\.(ar|br|uy|mx|bo|py|pe|co|cl|ve)$/;
  return COMPOUND.test(lastTwo) ? parts.slice(-3).join(".") : lastTwo;
}

export function sameSite(a: string, b: string): boolean {
  return registrableDomain(a) === registrableDomain(b);
}
