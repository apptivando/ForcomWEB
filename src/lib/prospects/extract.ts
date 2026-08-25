/**
 * Extracción de datos de contacto desde texto crudo.
 *
 * Se usa sobre tres fuentes distintas y es el mismo código para las tres:
 * el HTML del sitio del prospecto (nivel 1), el HTML de un directorio
 * comercial (nivel 3) y los resúmenes que devuelve la API de búsqueda de
 * Google (nivel 3, sin visitar nada).
 *
 * Sin parser de DOM: el proyecto no tiene dependencias de terceros para esto y
 * un `cheerio` entero para leer cuatro atributos no se justifica. El orden de
 * lectura compensa la falta de DOM: primero las señales estructuradas (`href`
 * de `mailto:`, `tel:`, `wa.me`), que son una afirmación explícita del dueño
 * del sitio, y recién después el texto plano, que es adivinanza.
 *
 * **La validación importa más que las expresiones regulares.** Una regex de
 * teléfono argentino razonable encuentra CUITs, CBUs y años; lo que hace la
 * diferencia es descartarlos después. Lo mismo con los emails: la regex es
 * fácil, lo difícil es no guardar `logo@2x.png` ni el mail de Sentry.
 */

// Imports relativos y no por el alias `@/`: así este módulo y sus vecinos se
// pueden correr con node directo desde `scripts/test-extract.mjs`, que es el
// banco de pruebas del extractor y no pasa por el bundler de Next.
import { digitsOnly, isValidArNational, looksLikeCuit, toWhatsappNumber, toE164Ar } from "../phone";
import { classifyUrl } from "./urls";

// ─── Preparación del texto ───────────────────────────────────────────────────

/**
 * Decodifica el ofuscador de emails de Cloudflare (`data-cfemail`).
 *
 * Vale la pena el esfuerzo: Cloudflare está en muchísimos sitios argentinos y
 * su protección reemplaza los mails del HTML por un blob hexadecimal. Sin esto,
 * un montón de comercios figuran como "sin email" cuando en realidad lo
 * publican. El formato es simple: el primer byte es la clave y se hace XOR con
 * cada uno de los siguientes.
 */
function decodeCfEmail(hex: string): string | null {
  if (hex.length < 4 || hex.length % 2 !== 0) return null;
  const key = parseInt(hex.slice(0, 2), 16);
  if (Number.isNaN(key)) return null;
  let out = "";
  for (let i = 2; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) return null;
    out += String.fromCharCode(byte ^ key);
  }
  return out.includes("@") ? out : null;
}

const ENTITIES: Array<[RegExp, string]> = [
  [/&#0*64;|&#x0*40;|%40/gi, "@"],
  [/&#0*46;|&#x0*2e;/gi, "."],
  [/&amp;/gi, "&"],
  [/&nbsp;|&#160;/gi, " "],
  [/&quot;|&#34;/gi, '"'],
  [/&#39;|&apos;/gi, "'"],
];

/**
 * Un `<script>` cuyo `type` declara JSON: `application/json`,
 * `application/ld+json`, y las variantes de los frameworks
 * (`application/x-…+json`). Un `<script>` sin `type`, o con
 * `text/javascript`, NO matchea — que es exactamente el punto.
 */
const JSON_SCRIPT_RE =
  /<script\b[^>]*\btype\s*=\s*["']application\/(?:[a-z0-9.-]*\+)?(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Saca el contenido de los `<script type="application/json">` y lo pega al
 * final del HTML, fuera de cualquier etiqueta, para que `prepareText` no se lo
 * lleve puesto.
 *
 * POR QUÉ EXISTE
 * `prepareText` borra todos los `<script>`, y hace bien: de ahí salen los
 * mails de Sentry, Wix y Google Tag Manager. Pero las páginas que renderizan
 * del lado del cliente dejan sus datos justamente ahí. Linktree y Beacons son
 * el caso que importa: los links que el comercio publicó viven SOLO dentro de
 * su `__NEXT_DATA__`, así que sin esto se las visita y se sale con las manos
 * vacías.
 *
 * **Solo los de tipo JSON, nunca todos.** Conservar los `<script>` en general
 * resucita exactamente la basura que el filtro de emails existe para sacar.
 *
 * Se aplica en el punto de entrada (una sola llamada en `enrich.ts`) y no
 * dentro de `prepareText`, así los cinco extractores siguen recibiendo un
 * string de HTML y no hay que pasarles una opción a cada uno.
 */
export function inlineJsonScripts(html: string): string {
  let rescued = "";
  for (const m of html.matchAll(JSON_SCRIPT_RE)) {
    // En el JSON las barras vienen escapadas (`https:\/\/wa.me\/549…`, y en
    // algunos frameworks `https://wa.me`). Sin desescapar, ni el
    // extractor de WhatsApp ni el de links reconocen una URL.
    rescued += ` ${m[1].replace(/\\u002[fF]/g, "/").replace(/\\\//g, "/")}`;
  }
  return rescued ? `${html}\n${rescued}` : html;
}

/**
 * Deja el texto en condiciones de que las regex encuentren lo que hay y no
 * basura. Sacar `<script>` y `<style>` es lo que más rinde: de ahí salen los
 * mails de Sentry, Google Tag Manager y Wix, que si no se cuelan en todos los
 * resultados.
 *
 * Si hace falta leer un `<script type="application/json">` —las páginas tipo
 * Linktree—, se pasa el HTML por `inlineJsonScripts` ANTES de llegar acá.
 */
export function prepareText(html: string): { text: string; cfEmails: string[] } {
  const cfEmails: string[] = [];
  for (const m of html.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi)) {
    const decoded = decodeCfEmail(m[1]);
    if (decoded) cfEmails.push(decoded);
  }

  let text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");

  for (const [re, to] of ENTITIES) text = text.replace(re, to);

  // Ofuscaciones a mano, que en sitios chicos son muy comunes.
  text = text
    .replace(/\s*[[(]\s*(at|arroba)\s*[\])]\s*/gi, "@")
    .replace(/\s*[[(]\s*(dot|punto)\s*[\])]\s*/gi, ".");

  return { text, cfEmails };
}

/** Versión sin etiquetas, para las búsquedas por proximidad de palabras. */
export function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

// ─── Emails ──────────────────────────────────────────────────────────────────

const EMAIL_RE =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,24}/g;

/** El falso positivo número uno: `logo@2x.png` parsea como email perfecto. */
const FILE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "ico", "bmp", "tiff",
  "css", "js", "mjs", "cjs", "json", "xml", "map",
  "mp4", "webm", "mp3", "wav", "ogg", "avi", "mov",
  "pdf", "zip", "rar", "doc", "docx", "xls", "xlsx",
  "woff", "woff2", "ttf", "eot", "otf",
  "html", "htm", "php", "asp", "aspx",
]);

/** Dominios de infraestructura: no son el mail de nadie. */
const INFRA_DOMAINS = [
  "sentry.io", "sentry-cdn.com", "sentry.wixpress.com", "ingest.sentry.io",
  "wixpress.com", "wix.com", "parastorage.com", "squarespace.com",
  "shopify.com", "myshopify.com", "godaddy.com", "jsdelivr.net", "unpkg.com",
  "cloudflare.com", "cloudflareinsights.com", "gstatic.com", "googleapis.com",
  "google-analytics.com", "googletagmanager.com", "w3.org", "schema.org",
  "example.com", "example.org", "example.net", "domain.com", "email.com",
  "sentry-next.wixpress.com", "cdn.ampproject.org",
];

const PLACEHOLDER_LOCALS = new Set([
  "email", "correo", "mail", "nombre", "name", "test", "demo", "sample",
  "user", "usuario", "tuemail", "tucorreo", "youremail", "ejemplo", "example",
  // "prueba" salió de una medición real: un comercio publicaba
  // `prueba@prueba.com` en su sitio y quedó guardado como su email.
  "prueba", "pruebas", "asd", "aaa", "xxx",
]);

/** Buzones de sistema: existen, pero nadie los lee. */
const SYSTEM_LOCALS = new Set([
  "noreply", "no-reply", "donotreply", "do-not-reply", "postmaster",
  "webmaster", "abuse", "hostmaster", "mailer-daemon", "bounce", "bounces",
]);

/** Locales de mail comercial: son los que sirven para vender. */
const COMMERCIAL_LOCALS = new Set([
  "ventas", "comercial", "info", "contacto", "consultas", "hola", "ventas1",
  "administracion", "compras", "atencion", "clientes", "pedidos", "presupuestos",
]);

const FREE_MAIL = /^(gmail|hotmail|yahoo|outlook|live|icloud|aol|yandex|proton(mail)?)\./i;

function isJunkEmail(email: string): boolean {
  if (email.length > 254) return true;
  const [local, domain] = email.toLowerCase().split("@");
  if (!local || !domain || local.length > 64) return true;

  const tld = domain.split(".").pop() ?? "";
  if (FILE_EXTENSIONS.has(tld)) return true;
  if (/^\d+x$/.test(local.split(".").pop() ?? "")) return true; // logo@2x, sprite@3x

  if (INFRA_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return true;
  if (/^(tu|your)?dominio|^yourdomain/.test(domain)) return true;
  if (PLACEHOLDER_LOCALS.has(local)) return true;
  if (SYSTEM_LOCALS.has(local)) return true;

  return false;
}

export interface EmailCandidate {
  email: string;
  score: number;
}

/**
 * Todos los emails plausibles del texto, ordenados por cuán probable es que
 * sirvan para vender. El puntaje refleja qué tan explícita es la señal: un
 * `mailto:` es una afirmación del dueño del sitio, un mail suelto en el texto
 * puede ser de cualquiera.
 */
export function extractEmails(
  html: string,
  opts: { siteDomain?: string; fromContactPage?: boolean } = {}
): EmailCandidate[] {
  const { text, cfEmails } = prepareText(html);
  const scores = new Map<string, number>();

  function offer(raw: string, bonus: number) {
    const email = raw.trim().toLowerCase().replace(/[.,;:)]+$/, "");
    if (!EMAIL_RE.test(email)) {
      EMAIL_RE.lastIndex = 0;
      return;
    }
    EMAIL_RE.lastIndex = 0;
    if (isJunkEmail(email)) return;

    const [local, domain] = email.split("@");
    let score = bonus;
    if (opts.siteDomain && domain.endsWith(opts.siteDomain)) score += 50;
    if (COMMERCIAL_LOCALS.has(local)) score += 30;
    if (opts.fromContactPage) score += 10;
    // El correo gratuito se penaliza, pero NO se descarta: media Argentina
    // comercial atiende por Gmail. Si es el único que hay, gana igual.
    if (FREE_MAIL.test(`${domain}.`)) score -= 20;

    scores.set(email, Math.max(scores.get(email) ?? -Infinity, score));
  }

  // 1. mailto: — la señal más explícita que existe.
  for (const m of text.matchAll(/mailto:([^"'?\s>]+)/gi)) offer(decodeURIComponent(m[1]), 100);

  // 2. Emails que Cloudflare había ocultado. Misma confianza que un mailto:
  //    porque es exactamente eso, ofuscado.
  for (const email of cfEmails) offer(email, 100);

  // 3. JSON-LD y metadatos estructurados.
  for (const m of text.matchAll(/"email"\s*:\s*"([^"]+)"/gi)) offer(m[1], 60);

  // 4. Texto visible.
  const visible = stripTags(text);
  for (const m of visible.matchAll(EMAIL_RE)) offer(m[0], 0);

  return [...scores.entries()]
    .map(([email, score]) => ({ email, score }))
    .sort((a, b) => b.score - a.score);
}

// ─── Teléfonos ───────────────────────────────────────────────────────────────

/**
 * Los límites son `[A-Za-z0-9]` y no `\d` por una razón que costó encontrar:
 * un hash hexadecimal como `6ef3802991029e2744…` contiene la corrida
 * `3802991029`, que es un teléfono argentino perfectamente válido rodeado de
 * LETRAS, no de dígitos. Con `(?<!\d)` pasaba el filtro y sitios grandes
 * (Disco, Easy) devolvían teléfonos inventados sacados de sus ids internos.
 */
const AR_PHONE_RE =
  /(?<![A-Za-z0-9])(?:(?:\+|00)?\s?54\s?)?(?:\(?\s?0?\s?(?:11|2\d{2,3}|3\d{2,3})\s?\)?)[\s.\-/]?(?:15[\s.\-]?)?\d{3,4}[\s.\-]?\d{4}(?![A-Za-z0-9])/g;

/**
 * Ruido que nunca contiene teléfonos y sí muchas corridas de dígitos: URLs,
 * rutas de archivos con hash, UUIDs y blobs hexadecimales. Sacarlo antes de
 * buscar teléfonos es más barato y más seguro que intentar distinguirlos
 * después.
 */
const DIGIT_NOISE =
  /(https?:|\\u002F)\S+|\b[0-9a-f]{16,}\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|\S+\.(?:png|jpe?g|webp|gif|svg|css|js|woff2?)\b/gi;

/** Palabras que, cerca de un número, delatan que NO es un teléfono. */
const FISCAL_CONTEXT = /\b(cuit|cuil|iibb|cbu|alias|ingresos\s+brutos|rnpa|res\.|resoluci[óo]n|dni|cuenta)\b/i;

function nearFiscalContext(haystack: string, index: number): boolean {
  return FISCAL_CONTEXT.test(haystack.slice(Math.max(0, index - 30), index + 30));
}

export interface PhoneCandidate {
  /** Nacional significativo, 10 dígitos. */
  national: string;
  /** E.164 sin '+', respetando fijo vs celular según lo que dijera la fuente. */
  e164: string;
  score: number;
  nearWhatsapp: boolean;
}

/**
 * Teléfonos argentinos del texto. La regex es permisiva a propósito; el filtro
 * de verdad es la validación posterior, que descarta CUITs (11 dígitos
 * arrancando en 20/23/24/27/30/33/34), CBUs y cualquier número cerca de una
 * palabra fiscal. Sin eso, el pie de página de cualquier comercio argentino
 * mete su CUIT como si fuera un teléfono.
 */
export function extractPhones(html: string): PhoneCandidate[] {
  const { text } = prepareText(html);
  const best = new Map<string, PhoneCandidate>();

  function offer(raw: string, bonus: number, context: string, index: number) {
    const digits = digitsOnly(raw);
    if (looksLikeCuit(digits)) return;
    if (digits.length >= 13) return; // CBU, tarjetas, códigos de producto
    if (nearFiscalContext(context, index)) return;

    const parsed = toE164Ar(raw);
    if (!parsed) return;
    const national = parsed.e164.replace(/^54(9)?/, "");
    if (!isValidArNational(national)) return;

    const window = context.slice(Math.max(0, index - 60), index + 60);
    const nearWhatsapp = /whats\s?app|wsp\b|wpp\b/i.test(window);

    const score = bonus + (nearWhatsapp ? 25 : 0);
    const prev = best.get(national);
    if (!prev || score > prev.score) {
      best.set(national, { national, e164: parsed.e164, score, nearWhatsapp });
    }
  }

  // 1. href="tel:" — explícito, le gana a cualquier cosa del texto.
  for (const m of text.matchAll(/href=["']tel:([^"']+)["']/gi)) {
    offer(m[1], 100, text, m.index ?? 0);
  }

  // 2. Datos estructurados.
  for (const m of text.matchAll(/"telephone"\s*:\s*"([^"]+)"/gi)) {
    offer(m[1], 60, text, m.index ?? 0);
  }

  // 3. Texto visible, con el ruido numérico ya sacado.
  const visible = stripTags(text).replace(DIGIT_NOISE, " ");
  for (const m of visible.matchAll(AR_PHONE_RE)) {
    offer(m[0], 0, visible, m.index ?? 0);
  }

  return [...best.values()].sort((a, b) => b.score - a.score);
}

// ─── WhatsApp ────────────────────────────────────────────────────────────────

const WA_LINK_RE =
  /(?:https?:)?\/\/(?:api\.whatsapp\.com\/send|wa\.me|web\.whatsapp\.com\/send|whatsapp\.com\/send)[^\s"'<>)]*/gi;
const WA_SCHEME_RE = /whatsapp:\/\/send\?[^\s"'<>]*/gi;
const WA_SHORT_RE = /(?:https?:)?\/\/wa\.link\/[A-Za-z0-9]+/gi;

export interface WhatsappFinding {
  /** Formato WhatsApp (549…), listo para `wa.me`. Null si hay evidencia sin número. */
  phone: string | null;
  source: "link" | "texto";
  /** Links de acortador que no se pudieron resolver, para dejar en las notas. */
  unresolvedLinks: string[];
}

function numberFromWaUrl(url: string): string | null {
  // wa.me/5493511234567
  const path = url.match(/wa\.me\/(\+?\d[\d\s-]*)/i);
  if (path) return toWhatsappNumber(path[1]);

  // ...?phone=549351... (api.whatsapp.com, web.whatsapp.com, whatsapp://send)
  const query = url.match(/[?&]phone=(\+?\d[\d%\s-]*)/i);
  if (query) return toWhatsappNumber(decodeURIComponent(query[1]));

  return null;
}

/**
 * Busca evidencia de WhatsApp. **Solo evidencia**: un enlace que el propio
 * comercio puso en su sitio, o un número escrito al lado de la palabra
 * WhatsApp. Nunca se infiere de que el número parezca un celular — eso va
 * aparte en `whatsapp_likely` y no cuenta como contacto confirmado.
 */
export function extractWhatsapp(html: string): WhatsappFinding | null {
  const { text } = prepareText(html);
  const unresolvedLinks: string[] = [];

  const links = [
    ...text.matchAll(WA_LINK_RE),
    ...text.matchAll(WA_SCHEME_RE),
  ].map((m) => m[0]);

  for (const link of links) {
    // Un link de grupo no es un contacto comercial: no sirve para vender y
    // meterse en un grupo ajeno es otra cosa completamente distinta.
    if (/chat\.whatsapp\.com/i.test(link)) continue;
    const phone = numberFromWaUrl(link);
    if (phone) return { phone, source: "link", unresolvedLinks: [] };
  }

  // Acortadores: hay evidencia, pero el número está del otro lado del redirect.
  // Lo resuelve el enriquecedor (necesita red); acá solo se reportan.
  for (const m of text.matchAll(WA_SHORT_RE)) unresolvedLinks.push(m[0]);

  // Último recurso: un teléfono válido a menos de 60 caracteres de la palabra
  // "WhatsApp". Menos confiable que un link, por eso va después.
  const byText = extractPhones(html).find((p) => p.nearWhatsapp);
  if (byText) {
    return { phone: toWhatsappNumber(byText.national), source: "texto", unresolvedLinks };
  }

  return unresolvedLinks.length > 0 ? { phone: null, source: "link", unresolvedLinks } : null;
}

// ─── Redes sociales ──────────────────────────────────────────────────────────

const SOCIAL_RE = {
  facebook:
    /https?:\/\/(?:www\.|m\.|web\.|business\.)?facebook\.com\/(?!sharer|share\.php|share\?|plugins|tr\?|dialog\/|v\d|photo|events\/|permalink)[A-Za-z0-9._%-]{2,60}(?:\/[A-Za-z0-9._%-]+)?/gi,
  instagram:
    /https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|reel|reels|explore|accounts|stories|share|direct)[A-Za-z0-9._]{1,30}\/?/gi,
  linkedin:
    /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in|showcase)\/[A-Za-z0-9._%-]{2,80}/gi,
};

/** Botones de compartir, que apuntan a la red pero no son el perfil de nadie. */
const SHARE_INTENT = /(sharer|\/share|[?&](u|url|text|title)=|intent\/)/i;

export interface SocialLinks {
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
}

/**
 * Perfiles de redes enlazados en el sitio. **Solo se guarda la URL** — estas
 * redes no se visitan nunca (exigen login y sus términos lo prohíben). El
 * valor está en que un vendedor abra el perfil y saque el contacto a mano en
 * diez segundos, algo que ningún scraper puede hacer.
 *
 * Se queda con el primero de cada red: los widgets de "seguinos" repiten el
 * mismo perfil en el header, el footer y cada página.
 */
export function extractSocials(html: string): SocialLinks {
  const { text } = prepareText(html);
  const out: SocialLinks = { facebook: null, instagram: null, linkedin: null };

  for (const [key, re] of Object.entries(SOCIAL_RE) as Array<[keyof SocialLinks, RegExp]>) {
    for (const m of text.matchAll(re)) {
      const raw = m[0];
      if (SHARE_INTENT.test(raw)) continue;
      const classified = classifyUrl(raw.split("?")[0]);
      if (classified.url) {
        out[key] = classified.url;
        break;
      }
    }
  }

  return out;
}

// ─── Links internos ──────────────────────────────────────────────────────────

/** Páginas que suelen tener los datos de contacto, en orden de qué tanto rinden. */
const CONTACT_HINTS: Array<[RegExp, number]> = [
  [/contact(o|anos|enos|-?us)?\b/i, 100],
  [/donde-?estamos|ubicacion|sucursal(es)?|locales/i, 70],
  [/qui[eé]nes-?somos|nosotros|about|institucional|empresa/i, 50],
  [/atenci[oó]n|ayuda|soporte/i, 30],
];

const SKIP_LINK = /\.(pdf|jpe?g|png|gif|svg|zip|docx?|xlsx?|mp4)(\?|$)|\/wp-admin|\/cart|\/checkout|[?&](add_to_cart|logout|action=)/i;

export interface ScoredLink {
  url: string;
  score: number;
}

/**
 * Links internos del sitio, puntuados por cuán probable es que tengan datos de
 * contacto. Se usa para elegir qué 3 páginas visitar después de la home.
 */
export function extractInternalLinks(html: string, baseUrl: string): ScoredLink[] {
  const { text } = prepareText(html);
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  const seen = new Map<string, number>();

  for (const m of text.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const href = m[1];
    const label = stripTags(m[2] ?? "");
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript|whatsapp):/i.test(href)) continue;
    if (SKIP_LINK.test(href)) continue;

    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.hostname !== base.hostname) continue;

    url.hash = "";
    const clean = url.toString();
    if (clean === base.toString()) continue;

    let score = 0;
    const haystack = `${url.pathname} ${label}`;
    for (const [re, points] of CONTACT_HINTS) {
      if (re.test(haystack)) score = Math.max(score, points);
    }
    if (score === 0) continue;

    seen.set(clean, Math.max(seen.get(clean) ?? 0, score));
  }

  return [...seen.entries()]
    .map(([url, score]) => ({ url, score }))
    .sort((a, b) => b.score - a.score);
}
