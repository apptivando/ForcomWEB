/**
 * Nivel 3 de la cascada: buscar en la web lo que el sitio del prospecto no dio.
 *
 * ─── Lo más valioso: no hace falta visitar nada ───────────────────────────
 * Cada resultado trae título, resumen y (según el proveedor) datos
 * estructurados. El resumen es lo que se muestra debajo del resultado en la
 * página de búsqueda, y muy seguido ya contiene el teléfono, el email, o la
 * biografía de un perfil de Instagram — que es justamente donde los comercios
 * argentinos ponen su WhatsApp. Leer el índice de un buscador no es scrapear
 * Instagram: es la vuelta legal al hecho de que las redes no se pueden visitar.
 *
 * ─── Historia de por qué esto es multi-proveedor ──────────────────────────
 * El plan original usaba Google Programmable Search. No se pudo:
 *
 *  1. **20/01/2026** — Google eliminó "buscar en toda la web" para motores
 *     nuevos (los viejos la conservan hasta el 01/01/2027). Se rediseñó para
 *     trabajar con un motor restringido a 50 dominios, que para la búsqueda
 *     inversa por teléfono incluso funciona mejor: los directorios comerciales
 *     son exactamente donde vive un teléfono indexado.
 *  2. **Después** — al probarlo con la key real: 403 `PERMISSION_DENIED`,
 *     "This project does not have the access to Custom Search JSON API".
 *     Google **cerró la API entera a clientes nuevos**. No es un problema de
 *     configuración ni de permisos de la key: los proyectos creados ahora no
 *     tienen acceso, punto. El reemplazo que ofrece Google es Vertex AI Search,
 *     un producto empresarial desproporcionado para esto.
 *
 * Por eso el proveedor se elige por variable de entorno y toda la lógica de
 * arriba (`enrich.ts`) habla con una sola función, `webSearch()`. Cambiar de
 * proveedor no toca nada más que este archivo.
 *
 * `PROSPECT_SEARCH_PROVIDER`:
 *   - `off`     → nivel 3 apagado (default si no hay credenciales)
 *   - `google`  → Programmable Search. Solo sirve en proyectos que ya tenían
 *                 acceso antes del cierre.
 *   - `serper`  → serper.dev. 2.500 consultas gratis por única vez, después
 *                 crédito prepago. Devuelve toda la web.
 *   - `brave`   → Brave Search API. Discontinuó su plan gratuito en feb/2026;
 *                 hoy cobra por consulta. Devuelve toda la web.
 *
 * Serper y Brave son APIs oficiales de esos proveedores, no scraping.
 *
 * Server-only.
 */

const GOOGLE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";
const SERPER_ENDPOINT = "https://google.serper.dev/search";
const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

export type SearchProvider = "off" | "google" | "serper" | "brave";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  /** Texto de datos estructurados (pagemap): teléfonos, direcciones, og:description. */
  structured: string;
}

export class SearchQuotaExceeded extends Error {
  // Sin parameter properties: node no las soporta al borrar tipos, y estos
  // módulos se corren con node directo desde los scripts de prueba.
  readonly used: number;
  readonly limit: number;

  constructor(used: number, limit: number) {
    super(`Tope diario de búsquedas alcanzado (${used}/${limit})`);
    this.name = "SearchQuotaExceeded";
    this.used = used;
    this.limit = limit;
  }
}

/**
 * Se apaga solo cuando el proveedor devuelve un error que no se va a arreglar
 * reintentando (típicamente el 403 de Google por no tener acceso a la API).
 * Sin esto, cada prospecto de cada lote gastaría tiempo en tres llamadas
 * condenadas a fallar.
 */
let disabledReason: string | null = null;

export function providerUnavailableReason(): string | null {
  return disabledReason;
}

export function currentProvider(): SearchProvider {
  const explicit = process.env.PROSPECT_SEARCH_PROVIDER?.trim().toLowerCase();
  if (explicit === "off") return "off";
  if (explicit === "serper" || explicit === "brave" || explicit === "google") return explicit;

  // Sin variable explícita, se deduce de las credenciales que haya cargadas.
  if (process.env.SERPER_API_KEY) return "serper";
  if (process.env.BRAVE_SEARCH_API_KEY) return "brave";
  if (process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX) return "google";
  return "off";
}

export function searchConfigured(): boolean {
  if (disabledReason) return false;
  const provider = currentProvider();
  if (provider === "off") return false;
  if (provider === "serper") return Boolean(process.env.SERPER_API_KEY);
  if (provider === "brave") return Boolean(process.env.BRAVE_SEARCH_API_KEY);
  return Boolean(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX);
}

export function dailyLimit(): number {
  const raw = Number(process.env.PROSPECT_SEARCH_DAILY_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? raw : 90;
}

interface RawItem {
  title?: string;
  link?: string;
  snippet?: string;
  htmlSnippet?: string;
  pagemap?: Record<string, Array<Record<string, unknown>>>;
}

/**
 * Aplana el `pagemap` a texto plano para pasárselo al extractor.
 * Ahí vienen `metatags.og:description` (la bio de Instagram), y a veces
 * `localbusiness.telephone` o `organization.email` ya separados.
 */
function flattenPagemap(pagemap: RawItem["pagemap"]): string {
  if (!pagemap) return "";
  const parts: string[] = [];
  for (const entries of Object.values(pagemap)) {
    for (const entry of entries.slice(0, 3)) {
      for (const value of Object.values(entry)) {
        if (typeof value === "string" && value.length < 500) parts.push(value);
      }
    }
  }
  return parts.join(" · ");
}

async function timedFetch(url: string | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

async function searchGoogle(query: string, num: number): Promise<SearchHit[]> {
  const url = new URL(GOOGLE_ENDPOINT);
  url.searchParams.set("key", process.env.GOOGLE_CSE_API_KEY!);
  url.searchParams.set("cx", process.env.GOOGLE_CSE_CX!);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(num, 10)));
  url.searchParams.set("hl", "es");
  url.searchParams.set("gl", "ar");
  url.searchParams.set("lr", "lang_es");
  // Explícito y no solo en la configuración del panel: es gratis y evita que un
  // cambio en el panel altere el comportamiento sin que nos enteremos. El filtro
  // de contenido explícito restaría prospectos legítimos por falsos positivos y
  // no protege a nadie: los resultados los procesa el código, no los ve nadie.
  url.searchParams.set("safe", "off");

  const res = await timedFetch(url);
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new SearchQuotaExceeded(dailyLimit(), dailyLimit());
    // Google cerró esta API a clientes nuevos: reintentar no la va a abrir.
    if (res.status === 403) {
      disabledReason =
        "Google cerró la Custom Search JSON API a proyectos nuevos. El nivel 3 queda apagado hasta cambiar de proveedor (PROSPECT_SEARCH_PROVIDER).";
      throw new Error(disabledReason);
    }
    throw new Error(`Google Search ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { items?: RawItem[] };
  return (data.items ?? [])
    .filter((it) => it.link)
    .map((it) => ({
      title: it.title ?? "",
      url: it.link!,
      snippet: it.snippet ?? "",
      structured: flattenPagemap(it.pagemap),
    }));
}

async function searchSerper(query: string, num: number): Promise<SearchHit[]> {
  const res = await timedFetch(SERPER_ENDPOINT, {
    method: "POST",
    headers: { "X-API-KEY": process.env.SERPER_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "ar", hl: "es", num: Math.min(num, 10) }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new SearchQuotaExceeded(dailyLimit(), dailyLimit());
    throw new Error(`Serper ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string; attributes?: Record<string, string> }>;
    knowledgeGraph?: { title?: string; website?: string; description?: string; attributes?: Record<string, string> };
  };

  const hits: SearchHit[] = (data.organic ?? [])
    .filter((it) => it.link)
    .map((it) => ({
      title: it.title ?? "",
      url: it.link!,
      snippet: it.snippet ?? "",
      structured: Object.values(it.attributes ?? {}).join(" · "),
    }));

  // El panel de la derecha de Google. Para un comercio local suele traer el
  // teléfono ya separado, así que vale más que cualquier resultado orgánico.
  const kg = data.knowledgeGraph;
  if (kg?.title) {
    hits.unshift({
      title: kg.title,
      url: kg.website ?? "",
      snippet: kg.description ?? "",
      structured: Object.values(kg.attributes ?? {}).join(" · "),
    });
  }

  return hits;
}

async function searchBrave(query: string, num: number): Promise<SearchHit[]> {
  const url = new URL(BRAVE_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.min(num, 20)));
  url.searchParams.set("country", "ar");
  url.searchParams.set("search_lang", "es");
  url.searchParams.set("safesearch", "off");

  const res = await timedFetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY!,
    },
  });
  if (!res.ok) {
    if (res.status === 429) throw new SearchQuotaExceeded(dailyLimit(), dailyLimit());
    throw new Error(`Brave Search ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string; extra_snippets?: string[] }> };
  };
  return (data.web?.results ?? [])
    .filter((it) => it.url)
    .map((it) => ({
      title: it.title ?? "",
      url: it.url!,
      snippet: it.description ?? "",
      structured: (it.extra_snippets ?? []).join(" · "),
    }));
}

/**
 * Una consulta al proveedor configurado. Es la única función que ve el resto
 * del sistema: cambiar de proveedor no cambia nada aguas arriba.
 *
 * `onQuota` se llama ANTES de gastar la consulta y decide si se puede seguir.
 * Es un callback y no una lectura de la base para que este módulo no dependa de
 * Supabase — el contador atómico vive en el enriquecedor.
 */
export async function webSearch(
  query: string,
  opts: { onQuota?: () => Promise<boolean>; num?: number } = {}
): Promise<SearchHit[]> {
  if (!searchConfigured()) return [];

  if (opts.onQuota && !(await opts.onQuota())) {
    throw new SearchQuotaExceeded(dailyLimit(), dailyLimit());
  }

  const num = opts.num ?? 10;
  try {
    switch (currentProvider()) {
      case "serper":
        return await searchSerper(query, num);
      case "brave":
        return await searchBrave(query, num);
      case "google":
        return await searchGoogle(query, num);
      default:
        return [];
    }
  } catch (err) {
    if (err instanceof SearchQuotaExceeded) throw err;
    // Un timeout no es motivo para tirar: se pierde una consulta y se sigue.
    if (err instanceof Error && err.name === "AbortError") return [];
    throw err;
  }
}

/**
 * Las consultas del nivel 3, en orden de cuánto rinden. El enriquecedor las
 * ejecuta una por una y corta apenas encuentra algo, así el caso típico gasta
 * una consulta y no tres.
 */
export function buildQueries(opts: {
  businessName: string | null;
  locality: string | null;
  nationalPhone: string | null;
}): string[] {
  const queries: string[] = [];
  const name = opts.businessName?.trim();
  const place = opts.locality?.trim();

  // 1. Búsqueda inversa por teléfono. La que más rinde para el email y la que
  //    mejor funciona restringida: los directorios comerciales son justamente
  //    el lugar donde vive un teléfono indexado.
  if (opts.nationalPhone) queries.push(`"${opts.nationalPhone}"`);

  // 2. Nombre + localidad: encuentra el perfil de red y la ficha de directorio
  //    aunque no estén enlazados en ningún lado.
  if (name) queries.push(`"${name}"${place ? ` ${place}` : ""}`);

  // 3. La misma, afinada, para cuando la anterior trae ruido.
  if (name) queries.push(`"${name}"${place ? ` ${place}` : ""} (whatsapp OR contacto)`);

  return queries;
}
