/**
 * El catálogo del cliente es un flipbook de Publuu. Del panel puede llegar
 * cualquiera de las formas en que Publuu lo comparte —el link de la barra,
 * el link de una página puntual, o el código <iframe> entero de "Embed"—,
 * así que acá se reconoce el par de números que lo identifica y se arma todo
 * lo demás a partir de eso.
 *
 * Publuu permite embeberlo desde cualquier sitio (responde con
 * `Content-Security-Policy: frame-ancestors *`, verificado el 16/10/2026).
 */
const PUBLUU_RE = /publuu\.com\/flip-book\/(\d+)\/(\d+)/i;

export interface Catalog {
  /** El link para abrirlo solo, en Publuu. Es lo que se guarda en la base. */
  url: string;
  /** El que va en el iframe: `?embed` saca la barra de Publuu de alrededor. */
  embedUrl: string;
}

export function parseCatalogUrl(raw: string | null | undefined): Catalog | null {
  const m = raw?.match(PUBLUU_RE);
  if (!m) return null;
  const url = `https://publuu.com/flip-book/${m[1]}/${m[2]}`;
  return { url, embedUrl: `${url}/page/1?embed` };
}
