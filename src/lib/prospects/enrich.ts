/**
 * Enriquecedor de prospectos: la cascada de cuatro niveles.
 *
 *   Nivel 0  Google Places        → nombre, dirección, teléfono, sitio, rating
 *      ↓  (si ya hay email y WhatsApp, corta)
 *   Nivel 1  Sitio web propio     → home + hasta 3 páginas · email, WA, redes
 *      ↓  (si no hay sitio, o el sitio no dio nada)
 *   Nivel 2  Redes enlazadas      → NO se visitan. Solo se guarda la URL.
 *      ↓
 *   Nivel 3  Búsqueda web         → resúmenes + hasta 3 páginas visitadas
 *      ↓
 *   Nivel 4  Sin contacto         → queda para resolver a mano
 *
 * Corre en el worker del cron y en el botón "Enriquecer ahora". Server-only.
 *
 * Nada de esto tira excepciones hacia arriba por un prospecto: un sitio caído
 * es lo normal, no una excepción, y si cada uno tirara, un lote de seis
 * fallaría por culpa del primero.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchHtml, resolveRedirect, sleep } from "./http";
import { isAllowed, DEFAULT_DELAY_MS } from "./robots";
import { classifyUrl, registrableDomain } from "./urls";
import {
  extractEmails,
  extractPhones,
  extractWhatsapp,
  extractSocials,
  extractInternalLinks,
  inlineJsonScripts,
} from "./extract";
import { webSearch, buildQueries, searchConfigured, dailyLimit, SearchQuotaExceeded } from "./search";
import { toWhatsappNumber } from "@/lib/phone";
import type { CrmContact } from "@/lib/types";

/** Páginas máximas por sitio (la home cuenta como una). */
const MAX_PAGES_PER_SITE = 4;
/** Presupuesto de tiempo por prospecto, para que un lote no se pase del límite. */
const SITE_BUDGET_MS = 20_000;
/** Resultados de búsqueda que se abren como máximo en el nivel 3. */
const MAX_SEARCH_VISITS = 3;

/**
 * Presupuesto de tiempo del nivel 3, el gemelo de `SITE_BUDGET_MS`.
 *
 * Sin esto el nivel 3 no tenía ningún reloj: cuatro consultas lentas más tres
 * visitas se comían el lote entero de seis prospectos. El worker tiene 240 s
 * para seis, o sea 40 s cada uno, y el nivel 1 ya se lleva 20.
 */
const SEARCH_BUDGET_MS = 18_000;

/**
 * Peso de un dominio propio del comercio, cuando la búsqueda encuentra un
 * sitio que Google Places no tenía.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ACÁ NO HAY UNA LISTA DE DIRECTORIOS COMERCIALES
 *
 * La había, y era la idea original del nivel 3: "los directorios publican el
 * email que el comercio no pone en ningún otro lado". Se probó contra
 * prospectos reales y NO FUNCIONA. Lo que devuelve abrir la ficha de un
 * comercio en un directorio son los contactos DEL DIRECTORIO: el mail de la
 * agencia web que arma esas fichas (apareció idéntico en dos comercios
 * distintos), un WhatsApp de CABA para comercios de Paraná, la casilla de la
 * redacción de un diario, dos correos chilenos.
 *
 * Es obvio en retrospectiva: una página de directorio es 90 % plantilla y pie
 * de página, y el extractor no distingue el contacto del comercio del contacto
 * de quien publica la página.
 *
 * Por eso el nivel 3 hoy **solo abre páginas del propio comercio** — su "link
 * in bio" o un dominio que lleva su nombre. De los directorios se lee
 * únicamente el resumen que devuelve el buscador, que sí está acotado al
 * resultado.
 *
 * Si alguna vez se quiere volver a abrirlos, el problema a resolver primero es
 * ese: extraer solo lo que está CERCA del nombre del comercio en la página, no
 * lo que está en cualquier parte de ella.
 * ────────────────────────────────────────────────────────────────────────────
 */
const DIRECTORY_WEIGHTS: Record<string, number> = {};

/**
 * Guías y directorios comerciales. La lista sigue existiendo, pero cambió de
 * signo: ya no dice qué abrir, dice **de dónde no creerle a los contactos**.
 *
 * Hace falta también en el nivel 1, no solo en el 3: Google Places a veces
 * publica como "sitio web" del comercio la ficha que un directorio le armó. El
 * caso que lo destapó fue una ferretería de Paraná cuyo `website` era una guía
 * de ferreterías: el crawler entró creyendo que era el sitio propio y se trajo
 * `hola@guiaferreterias.com.ar`, que es el mail de la guía.
 *
 * De estas páginas se siguen guardando las **redes sociales** —esas son la URL
 * del perfil del comercio y se identifican solas— y se descartan el correo y
 * el teléfono.
 */
const DIRECTORY_HOSTS = new Set([
  "guiaferreterias.com.ar", "paginasamarillas.com.ar", "cylex.com.ar",
  "guialocal.com.ar", "infoisinfo.com.ar", "opendi.com.ar", "tuugo.com.ar",
  "hotfrog.com.ar", "yalwa.com.ar", "dateas.com", "kompass.com",
  "guiaindustrial.com.ar", "elferretero.com.ar", "dir.ar", "empresite.com",
  "argentina.acambiode.com", "solomaquinaria.com.ar", "clasificados.com.ar",
]);

/**
 * ¿Este dominio es del comercio? Se le pide que lleve su nombre: "GTM
 * Ferretería" → `gtmferreteria.com.ar`. Es el único caso en que abrir una
 * página que Places no conocía vale un request.
 */
function dominioDelComercio(domain: string, contact: CrmContact): boolean {
  const raiz = normalizar(domain.split(".")[0] ?? "").replace(/ /g, "");
  if (raiz.length < 4) return false;
  const tokens = tokensDistintivos(contact.business_name);
  if (tokens.length === 0) return false;
  return tokens.some((t) => t.length >= 4 && raiz.includes(t));
}

/**
 * Peso de una página "link in bio" (Linktree y parecidas).
 *
 * Por encima de cualquier directorio: es una página que el propio comercio
 * armó para publicar sus contactos, contra una ficha que un tercero copió de
 * algún lado.
 */
const LINK_IN_BIO_WEIGHT = 200;

/**
 * Palabras que no distinguen a un comercio de otro. Se sacan del nombre antes
 * de usarlo para decidir si un resultado de búsqueda habla de este prospecto.
 */
const GENERICOS = new Set([
  "ferreteria", "corralon", "pintureria", "bulonera", "buloneria", "distribuidora",
  "comercial", "mayorista", "deposito", "sucursal", "casa", "centro", "grupo",
  "srl", "sa", "sas", "sh", "scs", "cia", "hnos", "hermanos", "hijos", "eirl",
  "the", "los", "las", "del", "san", "santa", "don", "todo", "super", "mega",
]);

/** Sin acentos, sin puntuación, en minúsculas. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    // Se saca la categoría Marca de Unicode: son los acentos que `NFD` acaba
    // de separar. Va por categoría y no por un rango de caracteres literales,
    // que en el editor son invisibles y se pierden al reformatear el archivo.
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Los pedazos del nombre que de verdad identifican al comercio.
 * "Ferretería San José" → ["jose"]. "Ferretería y Corralón" → [].
 */
function tokensDistintivos(name: string | null): string[] {
  if (!name) return [];
  return normalizar(name)
    .split(" ")
    .filter((t) => t.length >= 3 && !GENERICOS.has(t));
}

/**
 * El área telefónica, para exigir coherencia geográfica.
 *
 * Los códigos argentinos son de 2, 3 o 4 dígitos. Con los tres primeros del
 * nacional alcanza para distinguir una provincia de otra, que es lo único que
 * se le pide acá; el 11 se trata aparte porque es de dos.
 */
function areaDe(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const nacional = e164.replace(/^54(9)?/, "");
  if (nacional.length !== 10) return null;
  return nacional.startsWith("11") ? "11" : nacional.slice(0, 3);
}

/**
 * ¿Este resultado de búsqueda habla de ESTE comercio?
 *
 * POR QUÉ HACE FALTA
 * El nivel 3 le pasaba al extractor el resumen de los diez resultados, sin
 * preguntarse de quién eran. Con un nombre como "Ferretería Miguel" el
 * buscador devuelve ferreterías de todo el país, y se guardaba el primer
 * correo o teléfono que apareciera. Medido contra prospectos reales salieron
 * cosas como un mail alemán para una ferretería de Paraná y el WhatsApp de un
 * comercio de San Juan para uno de Jujuy.
 *
 * Ante la duda NO se absorbe. Un prospecto sin correo se resuelve a mano; uno
 * con el correo de otra empresa se descubre cuando la campaña ya salió.
 */
function hitEsDelProspecto(
  hit: { title: string; snippet: string; structured: string; url: string },
  contact: CrmContact,
  nationalPhone: string | null
): boolean {
  const texto = `${hit.title} ${hit.snippet} ${hit.structured} ${hit.url}`;

  // La evidencia más fuerte: el resultado repite el teléfono que buscamos.
  if (nationalPhone && texto.replace(/\D/g, "").includes(nationalPhone)) return true;

  // Si no, tienen que aparecer TODOS los pedazos distintivos del nombre.
  // Con "todos" y no "alguno": "Ferretería El Tornillo" no puede quedar
  // satisfecha con una página que solo dice "tornillo".
  const tokens = tokensDistintivos(contact.business_name);
  if (tokens.length === 0) return false;

  const plano = normalizar(texto);
  return tokens.every((t) => plano.includes(t));
}

/** Lo que la cascada logró averiguar de un prospecto. */
interface Findings {
  email: string | null;
  phoneE164: string | null;
  whatsapp: string | null;
  whatsappSource: "link" | "texto" | "busqueda" | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  notes: string[];
  level: number;
}

function emptyFindings(): Findings {
  return {
    email: null,
    phoneE164: null,
    whatsapp: null,
    whatsappSource: null,
    instagram: null,
    facebook: null,
    linkedin: null,
    notes: [],
    level: 0,
  };
}

/**
 * Los dos predicados de corte, que NO son el mismo.
 *
 * Hubo uno solo (`isSatisfied`, email + WhatsApp) para las dos decisiones, y
 * eso confundía dos cosas de costo muy distinto: leer una página más del sitio
 * cuesta 1,5 segundos de espera, y una consulta al buscador cuesta plata y
 * tiempo del lote.
 */

/**
 * Nivel 1: el ideal completo. Acá conviene ser ambicioso —el WhatsApp vale
 * prioridad 1 y una página más es barata—, así que el objetivo sigue siendo
 * email + WhatsApp.
 */
function isComplete(f: Findings): boolean {
  return Boolean(f.email && f.whatsapp);
}

/**
 * Nivel 3: cuándo dejar de gastar consultas.
 *
 * El objetivo es **email + una vía de voz**, sea WhatsApp o teléfono, porque
 * son los dos canales que se usan para contactar. Perseguir el WhatsApp con
 * consultas pagas cuando ya hay teléfono es gastar por un dato que hoy no
 * mueve nada.
 *
 * Mira `contact` además de `f` porque lo que ya estaba en la ficha cuenta
 * igual: si Google ya dio el teléfono, la vía de voz está resuelta antes de
 * empezar.
 */
function hasEnoughForSearch(f: Findings, contact: CrmContact): boolean {
  const email = f.email ?? contact.email;
  const voz = f.whatsapp ?? contact.whatsapp_phone ?? f.phoneE164 ?? contact.phone;
  return Boolean(email && voz);
}

/**
 * Vuelca lo encontrado en una página sobre el acumulado, sin pisar lo que ya
 * había.
 *
 * El `inlineJsonScripts` de la primera línea rescata el contenido de los
 * `<script type="application/json">` antes de que los extractores lo pierdan.
 * Sirve para dos cosas distintas:
 *
 * - **Las páginas tipo Linktree**, que renderizan del lado del cliente: sus
 *   links viven SOLO en ese bloque, así que sin esto se las visitaba y se
 *   salía con las manos vacías.
 * - **El JSON-LD de cualquier sitio.** `extractEmails` ya tenía una regla que
 *   puntúa `"email": "…"` con 60 justamente para leer schema.org — pero era
 *   código muerto, porque el JSON-LD vive dentro de un `<script>` y se
 *   descartaba antes de llegar ahí. Un bloque `Organization` o `LocalBusiness`
 *   trae teléfono, email y perfiles ya separados: es el dato más limpio que
 *   publica un sitio.
 *
 * Solo los `<script>` con `type` de JSON. Los demás siguen descartándose, que
 * es lo que mantiene afuera los mails de Sentry, Wix y Google Tag Manager.
 */
function absorb(
  f: Findings,
  raw: string,
  opts: {
    siteDomain?: string;
    fromContactPage?: boolean;
    waSource?: "link" | "texto" | "busqueda";
    /**
     * La página es de un directorio: se toman las redes y nada más. El correo
     * y el teléfono de una ficha de directorio son los del directorio.
     */
    soloRedes?: boolean;
    /**
     * Área telefónica que se espera. Solo lo usa el nivel 3: en el sitio propio
     * del comercio cualquier teléfono es suyo, pero en una página traída por
     * una búsqueda un número de otra provincia es casi seguro de otro comercio
     * con nombre parecido.
     */
    expectArea?: string | null;
  }
): void {
  const html = inlineJsonScripts(raw);
  const areaOk = (e164: string) => !opts.expectArea || areaDe(e164) === opts.expectArea;

  // Las redes se leen siempre: la URL de un perfil se identifica sola, incluso
  // en una ficha de directorio. Lo que no se cree son el correo y el teléfono.
  const socials = extractSocials(html);
  f.instagram ??= socials.instagram;
  f.facebook ??= socials.facebook;
  f.linkedin ??= socials.linkedin;
  if (opts.soloRedes) return;

  if (!f.email) {
    const best = extractEmails(html, opts)[0];
    if (best) f.email = best.email;
  }

  if (!f.whatsapp) {
    const wa = extractWhatsapp(html);
    if (wa?.phone && areaOk(wa.phone)) {
      f.whatsapp = wa.phone;
      f.whatsappSource = opts.waSource ?? wa.source;
    } else if (wa?.unresolvedLinks.length) {
      // Evidencia de WhatsApp sin número (un acortador wa.link). Se guarda el
      // link para que alguien lo abra: no da prioridad 1, pero es accionable.
      for (const link of wa.unresolvedLinks) {
        if (!f.notes.includes(link)) f.notes.push(link);
      }
    }
  }

  if (!f.phoneE164) {
    const best = extractPhones(html).find((p) => areaOk(p.e164));
    if (best) f.phoneE164 = best.e164;
  }
}

// ─── Nivel 1: el sitio del prospecto ─────────────────────────────────────────

async function runLevel1(
  contact: CrmContact,
  f: Findings
): Promise<{ error: string | null }> {
  if (!contact.website) return { error: null };

  const site = classifyUrl(contact.website);

  // El "sitio web" que publica Google puede ser en realidad una red social.
  // Se guarda como perfil y el prospecto salta directo al nivel 3.
  if (site.kind === "instagram") {
    f.instagram ??= site.url;
    return { error: null };
  }
  if (site.kind === "facebook") {
    f.facebook ??= site.url;
    return { error: null };
  }
  if (site.kind === "linkedin") {
    f.linkedin ??= site.url;
    return { error: null };
  }
  if (!site.url || !site.host) return { error: "el sitio publicado no es una URL válida" };

  // Un "link in bio" (Linktree y parecidas) sí se visita: no pide login, sus
  // términos no lo prohíben, y es literalmente la página que el comercio armó
  // para publicar sus contactos. Lo que cambia es que no se le siguen links
  // internos — ver abajo.
  const isLinkInBio = site.kind === "linkinbio";

  const started = Date.now();
  const siteDomain = registrableDomain(site.host);

  // Google Places a veces publica como "sitio web" del comercio la ficha que
  // un directorio le armó. De ahí salen los contactos del directorio, no los
  // del comercio: se entra igual (las redes sirven) pero no se le cree el
  // correo ni el teléfono.
  const esDirectorio = DIRECTORY_HOSTS.has(siteDomain);
  if (esDirectorio) f.notes.push(`el sitio publicado en Google es una guía comercial (${siteDomain})`);
  const visited = new Set<string>();
  const queue: Array<{ url: string; isContactPage: boolean }> = [
    { url: site.url, isContactPage: /contact/i.test(site.url) },
  ];
  let delayMs = DEFAULT_DELAY_MS;
  let firstError: string | null = null;
  let pagesRead = 0;

  while (queue.length > 0 && visited.size < MAX_PAGES_PER_SITE) {
    if (Date.now() - started > SITE_BUDGET_MS) {
      f.notes.push("se agotó el tiempo asignado al sitio");
      break;
    }

    const next = queue.shift()!;
    if (visited.has(next.url)) continue;
    visited.add(next.url);

    const verdict = await isAllowed(next.url);
    delayMs = Math.max(delayMs, verdict.delayMs);
    if (!verdict.allowed) {
      firstError ??= verdict.reason ?? "robots.txt no permite la visita";
      // Si el sitio está roto (DNS, TLS, 5xx) no tiene sentido probar el resto
      // de sus páginas: se corta y el prospecto sigue al nivel 3.
      if (verdict.siteBroken) break;
      continue;
    }

    const res = await fetchHtml(next.url);
    if (!res.ok) {
      firstError ??= `${res.reason}${res.detail ? `: ${res.detail}` : ""}`;
      await sleep(delayMs);
      continue;
    }

    pagesRead++;
    absorb(f, res.ok.body, { siteDomain, fromContactPage: next.isContactPage, soloRedes: esDirectorio });
    if (res.ok.truncated) f.notes.push("la página era muy grande y se leyó parcial");

    if (isComplete(f)) break;

    // Solo desde la home se eligen más páginas: seguir links desde una página
    // interna llevaría a recorrer el sitio entero.
    //
    // Y nunca desde un "link in bio": ahí los links del mismo host son las
    // páginas de OTROS comercios (`linktr.ee/otra-ferretería`). Hoy no pasa
    // por casualidad —esas rutas no matchean ningún patrón de "contacto" y
    // quedan en puntaje 0—, pero depender de una casualidad para no scrapear
    // el perfil de un tercero no es aceptable.
    if (visited.size === 1 && !isLinkInBio) {
      for (const link of extractInternalLinks(res.ok.body, res.ok.url).slice(0, MAX_PAGES_PER_SITE - 1)) {
        queue.push({ url: link.url, isContactPage: true });
      }
    }

    await sleep(delayMs);
  }

  if (pagesRead > 0) f.level = Math.max(f.level, 1);

  // Un acortador de WhatsApp esconde el número detrás de un redirect. Vale un
  // request extra: convierte una nota en un contacto de prioridad 1.
  if (!f.whatsapp) {
    const shortLink = f.notes.find((n) => /wa\.link\//i.test(n));
    if (shortLink) {
      const resolved = await resolveRedirect(shortLink.startsWith("http") ? shortLink : `https:${shortLink}`);
      const phone = resolved && toWhatsappNumber(resolved.replace(/^.*wa\.me\//, ""));
      if (phone) {
        f.whatsapp = phone;
        f.whatsappSource = "link";
        f.notes = f.notes.filter((n) => n !== shortLink);
      }
    }
  }

  return { error: pagesRead === 0 ? firstError : null };
}

// ─── Nivel 3: búsqueda en Google ─────────────────────────────────────────────

async function runLevel3(
  contact: CrmContact,
  f: Findings,
  onQuota: () => Promise<boolean>
): Promise<{ error: string | null; quotaHit: boolean }> {
  if (!searchConfigured()) return { error: null, quotaHit: false };

  const started = Date.now();
  const nationalPhone = contact.phone?.replace(/^54(9)?/, "") ?? null;
  const queries = buildQueries({
    businessName: contact.business_name,
    locality: contact.locality,
    nationalPhone,
    // La consulta a redes solo si no le conocemos ningún perfil. Si ya
    // tenemos su Instagram, buscarlo es tirar un crédito.
    wantsSocial: !f.instagram && !f.facebook && !contact.instagram_url && !contact.facebook_url,
  });
  if (queries.length === 0) return { error: null, quotaHit: false };

  const ownDomain = contact.website ? registrableDomain(classifyUrl(contact.website).host ?? "") : null;
  // Coherencia geográfica: si Google ya nos dio un teléfono, lo que encontremos
  // tiene que ser de la misma zona. Si no hay ninguno, no se exige nada — no
  // sería un filtro sino una adivinanza.
  const expectArea = areaDe(contact.phone) ?? areaDe(contact.whatsapp_phone) ?? null;
  // Peso, no orden de llegada: con tres visitas disponibles importa más cuál
  // se abre que si está o no en la lista.
  const candidates = new Map<string, number>();

  for (const query of queries) {
    if (Date.now() - started > SEARCH_BUDGET_MS) {
      f.notes.push("se agotó el tiempo asignado a la búsqueda");
      break;
    }

    let hits;
    try {
      hits = await webSearch(query, { onQuota });
    } catch (err) {
      if (err instanceof SearchQuotaExceeded) return { error: null, quotaHit: true };
      return { error: err instanceof Error ? err.message : "búsqueda fallida", quotaHit: false };
    }

    f.level = Math.max(f.level, 3);

    for (const hit of hits) {
      const texto = `${hit.title} ${hit.snippet} ${hit.structured} ${hit.url}`;

      // ¿El resultado habla de este comercio? Y sobre todo: ¿con qué fuerza?
      const eco = Boolean(nationalPhone && texto.replace(/\D/g, "").includes(nationalPhone));
      const porNombre = hitEsDelProspecto(hit, contact, nationalPhone);
      if (!porNombre && !eco) continue;

      // Los perfiles de red se toman con la coincidencia por nombre, que es
      // más floja, porque el dato ES la URL: un `instagram.com/eltornillo` se
      // identifica solo, y si es de otro comercio se ve al abrirlo. El costo
      // de equivocarse es que un vendedor pierda diez segundos.
      const socials = extractSocials(texto);
      f.instagram ??= socials.instagram;
      f.facebook ??= socials.facebook;
      f.linkedin ??= socials.linkedin;

      // El correo y el teléfono, en cambio, SOLO con eco del teléfono: que el
      // resultado repita el número que ya sabíamos de este comercio.
      //
      // POR QUÉ TAN ESTRICTO
      // Medido contra prospectos reales, la coincidencia por nombre no alcanza
      // ni de lejos. "Ferretería Avenida" matchea cualquier página que diga
      // "avenida"; "Ferretería del Paraná", cualquiera que hable de Paraná. Con
      // ese filtro solo salieron el mail de la agencia web que arma las fichas
      // de un directorio (el mismo en dos comercios distintos), el de la
      // redacción de un diario y dos correos chilenos.
      // Un prospecto sin correo se resuelve a mano. Uno con el correo de otra
      // empresa se descubre cuando la campaña ya salió.
      if (eco) absorb(f, texto, { waSource: "busqueda", expectArea });

      const kind = classifyUrl(hit.url);
      if (!kind.host) continue;
      const domain = registrableDomain(kind.host);
      if (domain === ownDomain) continue;

      // Solo se abren páginas que son DEL COMERCIO: su "link in bio", o un
      // dominio que lleva su nombre. Los directorios quedaron afuera — ver el
      // comentario de `DIRECTORY_WEIGHTS`.
      if (kind.kind === "linkinbio" && porNombre) {
        candidates.set(hit.url, Math.max(candidates.get(hit.url) ?? 0, LINK_IN_BIO_WEIGHT));
      } else if (kind.kind === "web" && dominioDelComercio(domain, contact)) {
        candidates.set(hit.url, Math.max(candidates.get(hit.url) ?? 0, DIRECTORY_WEIGHTS[domain] ?? 100));
      }
    }

    if (hasEnoughForSearch(f, contact)) return { error: null, quotaHit: false };
  }

  // Si el resumen no alcanzó, se abren hasta tres páginas del propio comercio.
  // Nunca una red social ni un directorio.
  const ordered = [...candidates.entries()].sort((a, b) => b[1] - a[1]).map(([url]) => url);

  let visits = 0;
  for (const url of ordered) {
    if (visits >= MAX_SEARCH_VISITS || hasEnoughForSearch(f, contact)) break;
    if (Date.now() - started > SEARCH_BUDGET_MS) {
      f.notes.push("se agotó el tiempo asignado a la búsqueda");
      break;
    }

    const verdict = await isAllowed(url);
    if (!verdict.allowed) continue;

    const res = await fetchHtml(url);
    if (!res.ok) continue;

    visits++;
    // LA PRUEBA DE IDENTIDAD, y es la única que resistió medirse contra datos
    // reales: la página tiene que repetir el teléfono que ya sabíamos de este
    // comercio. Que el dominio lleve su nombre NO alcanza — "Ferretería
    // Imperio" de Paraná terminó con el correo de una ferretería mexicana
    // homónima, cuyo dominio es `ferreteriaimperio.com` y pasa cualquier
    // control de parecido.
    //
    // Lo que cuesta: si el comercio no publica su teléfono en esa página, se
    // pierde el correo que estaba ahí. Se paga con gusto — un correo perdido
    // se resuelve a mano; uno equivocado se descubre cuando la campaña salió.
    const confirma = Boolean(nationalPhone && res.ok.body.replace(/\D/g, "").includes(nationalPhone));
    absorb(f, res.ok.body, { waSource: "busqueda", expectArea, soloRedes: !confirma });
    await sleep(verdict.delayMs);
  }

  return { error: null, quotaHit: false };
}

// ─── Orquestador ─────────────────────────────────────────────────────────────

export interface EnrichOutcome {
  contactId: string;
  status: "done" | "failed";
  level: number;
  found: { email: boolean; whatsapp: boolean; phone: boolean };
  error: string | null;
}

/** Enriquece un prospecto y guarda el resultado. Nunca tira. */
export async function enrichContact(
  supabase: SupabaseClient,
  contact: CrmContact,
  onQuota: () => Promise<boolean>
): Promise<EnrichOutcome> {
  const f = emptyFindings();
  let error: string | null = null;

  try {
    const level1 = await runLevel1(contact, f);
    error = level1.error;

    // El nivel 3 solo se gasta en quien todavía no tiene con qué contactarlo.
    // Nunca en todos: es lo que mantiene el costo acotado.
    //
    // La condición mira EMAIL + una vía de voz, no email + WhatsApp. La
    // versión anterior dejaba afuera al prospecto que tiene WhatsApp y no
    // tiene correo — que con el rumbo actual es justamente el que hay que
    // buscar, porque el correo es lo que necesita la campaña.
    if (!hasEnoughForSearch(f, contact)) {
      const level3 = await runLevel3(contact, f, onQuota);
      if (level3.quotaHit) {
        // Se agotó la cuota del día. NO es un fallo del prospecto: vuelve a la
        // cola con el estado 'pending' y SIN gastarle un intento, así mañana
        // se reintenta igual que si nunca se hubiera tocado. Lo poco que el
        // nivel 1 haya encontrado (perfiles de redes) se guarda igual.
        await supabase
          .from("crm_contacts")
          .update({
            enrichment_status: "pending",
            instagram_url: f.instagram ?? contact.instagram_url,
            facebook_url: f.facebook ?? contact.facebook_url,
            linkedin_url: f.linkedin ?? contact.linkedin_url,
          })
          .eq("id", contact.id);

        return {
          contactId: contact.id,
          status: "done",
          level: f.level,
          found: { email: false, whatsapp: false, phone: false },
          error: "cuota diaria de búsqueda agotada — vuelve a la cola",
        };
      }
      error ??= level3.error;
    }

    if (!f.email && !f.whatsapp && !f.phoneE164) f.level = Math.max(f.level, 4);
  } catch (err) {
    error = err instanceof Error ? err.message : "error desconocido";
  }

  // Solo se escribe lo que falta: nada de pisar datos que ya estaban, ni los
  // que alguien cargó a mano (esas fichas ni siquiera entran a la cola).
  const patch: Record<string, unknown> = {
    enrichment_status: "done",
    enrichment_level: f.level,
    enrichment_error: error,
    last_scraped_at: new Date().toISOString(),
    scrape_attempts: contact.scrape_attempts + 1,
    updated_at: new Date().toISOString(),
  };

  if (f.email && !contact.email) patch.email = f.email;
  if (f.whatsapp && !contact.whatsapp_phone) {
    patch.whatsapp_phone = f.whatsapp;
    patch.whatsapp_source = f.whatsappSource;
  }
  if (f.phoneE164 && !contact.phone) patch.phone = f.phoneE164;
  if (f.instagram && !contact.instagram_url) patch.instagram_url = f.instagram;
  if (f.facebook && !contact.facebook_url) patch.facebook_url = f.facebook;
  if (f.linkedin && !contact.linkedin_url) patch.linkedin_url = f.linkedin;
  if (f.notes.length > 0) {
    patch.notes = [contact.notes, ...f.notes].filter(Boolean).join("\n").slice(0, 2000);
  }

  // Un fallo total y sin nada encontrado se marca como tal para que el tercer
  // intento lo saque de la cola en vez de reintentarlo para siempre.
  if (error && f.level === 0) patch.enrichment_status = "failed";

  const { error: dbError } = await supabase.from("crm_contacts").update(patch).eq("id", contact.id);

  return {
    contactId: contact.id,
    status: (patch.enrichment_status as "done" | "failed") ?? "done",
    level: f.level,
    found: {
      email: Boolean(f.email),
      whatsapp: Boolean(f.whatsapp),
      phone: Boolean(f.phoneE164),
    },
    error: dbError?.message ?? error,
  };
}

export interface BatchResult {
  processed: number;
  requeued: number;
  found: { email: number; whatsapp: number; phone: number };
  quotaUsed: number;
  quotaExhausted: boolean;
  outcomes: EnrichOutcome[];
}

/**
 * Procesa un lote. Reclama los prospectos con `FOR UPDATE SKIP LOCKED` para
 * que dos corridas solapadas del cron no visiten los mismos sitios.
 *
 * `deadline` es un presupuesto propio de tiempo, más corto que el límite de la
 * función: sin él, Vercel podría matar el proceso en medio de un UPDATE y
 * dejar prospectos colgados en 'running'.
 */
export async function enrichBatch(
  supabase: SupabaseClient,
  opts: { limit: number; deadline?: number } = { limit: 5 }
): Promise<BatchResult> {
  const deadline = opts.deadline ?? Date.now() + 240_000;

  // Rescata lo que quedó colgado por un deploy o un timeout previo.
  const { data: requeued } = await supabase.rpc("requeue_stale_enrichments");

  const { data: claimed, error } = await supabase.rpc("claim_prospects_for_enrichment", {
    p_limit: opts.limit,
  });
  if (error) throw new Error(error.message);

  const contacts = (claimed ?? []) as CrmContact[];
  const outcomes: EnrichOutcome[] = [];
  const limit = dailyLimit();
  let quotaUsed = 0;
  let quotaExhausted = false;

  // Contador de cuota atómico en la base: el worker es serverless y no tiene
  // estado entre invocaciones, así que un contador en memoria no serviría.
  const onQuota = async (): Promise<boolean> => {
    if (quotaExhausted) return false;
    const { data } = await supabase.rpc("bump_cse_usage", { p_limit: limit });
    const row = Array.isArray(data) ? data[0] : data;
    quotaUsed++;
    if (!row?.allowed) {
      quotaExhausted = true;
      return false;
    }
    return true;
  };

  for (const contact of contacts) {
    if (Date.now() > deadline) {
      // Se acabó el tiempo: lo que no se procesó vuelve a la cola tal cual.
      await supabase
        .from("crm_contacts")
        .update({ enrichment_status: "pending" })
        .eq("id", contact.id)
        .eq("enrichment_status", "running");
      continue;
    }
    outcomes.push(await enrichContact(supabase, contact, onQuota));
  }

  return {
    processed: outcomes.length,
    requeued: typeof requeued === "number" ? requeued : 0,
    found: {
      email: outcomes.filter((o) => o.found.email).length,
      whatsapp: outcomes.filter((o) => o.found.whatsapp).length,
      phone: outcomes.filter((o) => o.found.phone).length,
    },
    quotaUsed,
    quotaExhausted,
    outcomes,
  };
}
