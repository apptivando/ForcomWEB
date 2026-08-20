/**
 * Fetch acotado para visitar sitios de terceros.
 *
 * Todo lo que sale a internet desde el enriquecedor pasa por acá. Las tres
 * cosas que importan y que un `fetch` pelado no da:
 *
 *  1. **Timeout.** Un sitio que acepta la conexión y nunca responde colgaría el
 *     lote entero hasta que Vercel mate la función a mitad de un UPDATE.
 *  2. **Tope de tamaño.** Un HTML de 40 MB (existen) haría OOM al worker. Se
 *     lee por chunks y se corta.
 *  3. **Nunca tira.** Devuelve `null` con motivo. Un sitio caído es lo normal,
 *     no una excepción: si cada uno tirara, un lote de 6 fallaría por el primero.
 *
 * Server-only.
 */

import { registrableDomain } from "./urls";

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;

/**
 * User-Agent identificable, con un mail de contacto. No es cortesía: es lo que
 * le permite al dueño de un sitio pedirnos que dejemos de entrar en vez de
 * bloquearnos la IP a ciegas.
 */
export function userAgent(): string {
  return (
    process.env.PROSPECT_USER_AGENT ??
    "ForcomBot/1.0 (+https://forcom.tech; ventas@forcom.tech)"
  );
}

export interface FetchResult {
  url: string;
  status: number;
  body: string;
  truncated: boolean;
}

export type FetchFailure =
  | "timeout"
  | "network"
  | "http-error"
  | "not-html"
  | "too-many-redirects"
  | "offsite-redirect"
  | "bad-url";

export interface FetchOutcome {
  ok: FetchResult | null;
  reason: FetchFailure | null;
  detail?: string;
}

/** Lee el cuerpo por chunks y corta en `maxBytes`. */
async function readCapped(res: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: await res.text(), truncated: false };

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let out = "";
  let total = 0;
  let truncated = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      out += decoder.decode(value.slice(0, Math.max(0, value.byteLength - (total - maxBytes))));
      truncated = true;
      await reader.cancel().catch(() => {});
      break;
    }
    out += decoder.decode(value, { stream: true });
  }
  if (!truncated) out += decoder.decode();
  return { text: out, truncated };
}

/**
 * Trae el HTML de una URL. Sigue redirects a mano (hasta 3) para poder
 * verificar que no nos manden a otro dominio: un acortador o un parking podría
 * sacarnos del sitio del prospecto sin que nos demos cuenta.
 */
export async function fetchHtml(
  rawUrl: string,
  opts: { timeoutMs?: number; maxBytes?: number; allowCrossDomain?: boolean } = {}
): Promise<FetchOutcome> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    return { ok: null, reason: "bad-url" };
  }
  const originDomain = registrableDomain(current.hostname);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": userAgent(),
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "es-AR,es;q=0.9",
        },
        cache: "no-store",
      });
    } catch (err) {
      clearTimeout(timer);
      const aborted = err instanceof Error && err.name === "AbortError";
      return {
        ok: null,
        reason: aborted ? "timeout" : "network",
        detail: err instanceof Error ? err.message : undefined,
      };
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return { ok: null, reason: "http-error", detail: `${res.status} sin Location` };
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return { ok: null, reason: "bad-url", detail: location };
      }
      if (!opts.allowCrossDomain && registrableDomain(next.hostname) !== originDomain) {
        return { ok: null, reason: "offsite-redirect", detail: next.hostname };
      }
      current = next;
      continue;
    }

    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return { ok: null, reason: "http-error", detail: String(res.status) };
    }

    // Nada de PDFs, imágenes ni descargas: solo HTML.
    const ctype = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(ctype)) {
      await res.body?.cancel().catch(() => {});
      return { ok: null, reason: "not-html", detail: ctype.split(";")[0] };
    }

    const { text, truncated } = await readCapped(res, maxBytes);
    return { ok: { url: current.toString(), status: res.status, body: text, truncated }, reason: null };
  }

  return { ok: null, reason: "too-many-redirects" };
}

/**
 * Resuelve un acortador siguiendo su redirect, sin descargar el destino.
 * Se usa para `wa.link/xxxx`, que esconde el número de WhatsApp detrás de un
 * redirect a `wa.me`. Acá sí se permite cambiar de dominio: es el punto.
 */
export async function resolveRedirect(rawUrl: string, timeoutMs = 5_000): Promise<string | null> {
  let current: string = rawUrl;
  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": userAgent() },
        cache: "no-store",
      });
      clearTimeout(timer);
      await res.body?.cancel().catch(() => {});

      if (res.status < 300 || res.status >= 400) return hop === 0 ? null : current;
      const location = res.headers.get("location");
      if (!location) return null;
      current = new URL(location, current).toString();
    } catch {
      clearTimeout(timer);
      return null;
    }
  }
  return current;
}

/** Espera entre requests al mismo host. */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
