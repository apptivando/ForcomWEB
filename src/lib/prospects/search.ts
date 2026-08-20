/**
 * Nivel 3 de la cascada: buscar en Google lo que el sitio del prospecto no dio.
 *
 * ─── Por qué está restringido a 50 dominios ───────────────────────────────
 * Google **eliminó la opción "buscar en toda la web"** de Programmable Search
 * Engine para motores nuevos el 20/01/2026 (los viejos la conservan hasta el
 * 01/01/2027). Un motor creado hoy solo puede buscar en hasta 50 dominios.
 * No es configurable ni evitable; el reemplazo que ofrece Google es Vertex AI
 * Search, un producto empresarial pago desproporcionado para esto.
 *
 * La restricción se convierte en ventaja eligiendo bien los 50: los directorios
 * comerciales argentinos son exactamente donde vive un teléfono indexado, así
 * que la búsqueda inversa funciona MEJOR sin el ruido del resto de la web. Ver
 * la lista sugerida en el plan (apéndice E.1).
 *
 * ─── Lo más valioso: no hace falta visitar nada ───────────────────────────
 * Cada resultado trae `title`, `snippet` y `pagemap`. El snippet es el resumen
 * que Google muestra debajo del resultado, y muy seguido ya contiene el
 * teléfono, el email, o la biografía de un perfil de Instagram — que es
 * justamente donde los comercios argentinos ponen su WhatsApp. Leer el índice
 * de Google no es scrapear Instagram: es la vuelta legal al hecho de que las
 * redes no se pueden visitar.
 *
 * Server-only.
 */

const ENDPOINT = "https://www.googleapis.com/customsearch/v1";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  /** Texto de datos estructurados (pagemap): teléfonos, direcciones, og:description. */
  structured: string;
}

export class SearchQuotaExceeded extends Error {
  constructor(readonly used: number, readonly limit: number) {
    super(`Tope diario de búsquedas alcanzado (${used}/${limit})`);
    this.name = "SearchQuotaExceeded";
  }
}

export function searchConfigured(): boolean {
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

/**
 * Una consulta a Programmable Search.
 *
 * `onQuota` se llama ANTES de gastar la consulta y decide si se puede seguir.
 * Es un callback y no una lectura directa de la base para que este módulo no
 * dependa de Supabase — el contador atómico vive en el enriquecedor.
 */
export async function webSearch(
  query: string,
  opts: { onQuota?: () => Promise<boolean>; num?: number } = {}
): Promise<SearchHit[]> {
  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) return [];

  if (opts.onQuota && !(await opts.onQuota())) {
    throw new SearchQuotaExceeded(dailyLimit(), dailyLimit());
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(opts.num ?? 10, 10)));
  url.searchParams.set("hl", "es");
  url.searchParams.set("gl", "ar");
  url.searchParams.set("lr", "lang_es");
  // Explícito y no solo en la configuración del panel: es gratis y evita que
  // un cambio en el panel altere el comportamiento sin que nos enteremos. El
  // filtro de contenido explícito nos restaría prospectos legítimos por falsos
  // positivos y no protege a nadie: los resultados los procesa el código.
  url.searchParams.set("safe", "off");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text();
      // 429 = cuota de Google agotada (no la nuestra). No es un error del
      // prospecto: se corta el nivel 3 por hoy y se reintenta mañana.
      if (res.status === 429) throw new SearchQuotaExceeded(dailyLimit(), dailyLimit());
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
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof SearchQuotaExceeded) throw err;
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
