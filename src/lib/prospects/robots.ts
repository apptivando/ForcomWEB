/**
 * Lectura y respeto de `robots.txt`.
 *
 * No es un parser completo del estándar — es el subconjunto que importa para
 * decidir si podemos pedir una URL: grupos por `User-agent`, `Allow`,
 * `Disallow` y `Crawl-delay`, con la regla de "gana la coincidencia de path
 * más larga" que usan Google y el RFC 9309.
 *
 * Criterio ante la duda: **no entrar**. Si el robots.txt no se puede leer por
 * timeout o error del servidor, se asume prohibido. Un 404 sí significa
 * permitido (es lo que dice el estándar y lo que hace todo el mundo).
 */

import { userAgent, sleep } from "./http";

const BOT_NAME = "forcombot";
/** Tope al Crawl-delay que estamos dispuestos a esperar. */
const MAX_CRAWL_DELAY_MS = 10_000;
export const DEFAULT_DELAY_MS = 1_500;

interface Rule {
  allow: boolean;
  path: string;
}

interface RobotsPolicy {
  rules: Rule[];
  crawlDelayMs: number;
  /** Verdadero si no se pudo leer el archivo y hay que asumir lo peor. */
  unavailable: boolean;
  /**
   * Por qué no se pudo leer. Importa para el operador: "el dominio no existe"
   * significa que el sitio que publica Google está muerto y el prospecto tiene
   * que ir directo al nivel 3, mientras que "el servidor nos rechazó" puede ser
   * temporal y conviene reintentar.
   */
  unavailableReason?: string;
}

/** Traduce los códigos de error de red a algo que se entienda en la ficha. */
function describeNetworkError(err: unknown): string {
  const code =
    (err as { cause?: { code?: string } })?.cause?.code ??
    (err as { code?: string })?.code ??
    "";
  if (err instanceof Error && err.name === "AbortError") return "el sitio no respondió a tiempo";
  switch (code) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return "el dominio no existe";
    case "CERT_HAS_EXPIRED":
    case "ERR_TLS_CERT_ALTNAME_INVALID":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
      return "el certificado del sitio es inválido";
    case "ECONNREFUSED":
      return "el servidor rechazó la conexión";
    case "ECONNRESET":
      return "el servidor cortó la conexión";
    default:
      return "no se pudo conectar con el sitio";
  }
}

/**
 * Caché por host, viva solo durante la corrida del worker (proceso serverless).
 * Sin esto, visitar 4 páginas de un sitio pediría robots.txt 4 veces.
 */
const cache = new Map<string, RobotsPolicy>();

function parseRobots(text: string): RobotsPolicy {
  // Se juntan los dos grupos que nos aplican: el específico de ForcomBot y el
  // genérico. Si existe uno específico, ese manda y el `*` se descarta —
  // así lo define el estándar.
  const groups = new Map<string, Rule[]>();
  const delays = new Map<string, number>();

  let currentAgents: string[] = [];
  let expectingAgents = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;

    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const field = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();

    if (field === "user-agent") {
      if (!expectingAgents) {
        currentAgents = [];
        expectingAgents = true;
      }
      currentAgents.push(value.toLowerCase());
      if (!groups.has(value.toLowerCase())) groups.set(value.toLowerCase(), []);
      continue;
    }

    expectingAgents = false;
    if (currentAgents.length === 0) continue;

    if (field === "allow" || field === "disallow") {
      // `Disallow:` vacío significa "permitir todo" — no es una regla.
      if (field === "disallow" && value === "") continue;
      for (const agent of currentAgents) {
        groups.get(agent)!.push({ allow: field === "allow", path: value });
      }
    } else if (field === "crawl-delay") {
      const seconds = Number(value.replace(",", "."));
      if (Number.isFinite(seconds) && seconds > 0) {
        for (const agent of currentAgents) delays.set(agent, seconds * 1000);
      }
    }
  }

  const agentKey = groups.has(BOT_NAME) ? BOT_NAME : "*";
  return {
    rules: groups.get(agentKey) ?? [],
    crawlDelayMs: Math.min(delays.get(agentKey) ?? DEFAULT_DELAY_MS, MAX_CRAWL_DELAY_MS),
    unavailable: false,
  };
}

/** Convierte un patrón de robots (con `*` y `$`) en regex anclada al inicio. */
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  const anchored = escaped.endsWith("\\$") ? `${escaped.slice(0, -2)}$` : escaped;
  return new RegExp(`^${anchored}`);
}

async function loadPolicy(origin: string): Promise<RobotsPolicy> {
  const cached = cache.get(origin);
  if (cached) return cached;

  // Se reusa fetchHtml con timeout corto, pero robots.txt es text/plain, así
  // que va con un fetch propio: el filtro de content-type de fetchHtml lo
  // rechazaría.
  let policy: RobotsPolicy;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      signal: controller.signal,
      headers: { "User-Agent": userAgent(), Accept: "text/plain" },
      cache: "no-store",
      redirect: "follow",
    });
    clearTimeout(timer);

    if (res.status === 404 || res.status === 410) {
      // Sin robots.txt: permitido. Es lo que dice el estándar.
      policy = { rules: [], crawlDelayMs: DEFAULT_DELAY_MS, unavailable: false };
      await res.body?.cancel().catch(() => {});
    } else if (!res.ok) {
      // 5xx o 403 sobre el propio robots.txt: conservador, no entramos.
      policy = {
        rules: [],
        crawlDelayMs: DEFAULT_DELAY_MS,
        unavailable: true,
        unavailableReason: `el servidor respondió ${res.status} al pedir robots.txt`,
      };
      await res.body?.cancel().catch(() => {});
    } else {
      const text = (await res.text()).slice(0, 512_000);
      policy = parseRobots(text);
    }
  } catch (err) {
    clearTimeout(timer);
    policy = {
      rules: [],
      crawlDelayMs: DEFAULT_DELAY_MS,
      unavailable: true,
      unavailableReason: describeNetworkError(err),
    };
  }

  cache.set(origin, policy);
  return policy;
}

export interface RobotsVerdict {
  allowed: boolean;
  /** Cuánto esperar antes del próximo pedido a este host. */
  delayMs: number;
  reason?: string;
  /**
   * El sitio está caído o roto (DNS, TLS, 5xx), no es que nos hayan prohibido
   * la entrada. El enriquecedor lo usa para decidir si el prospecto merece
   * saltar al nivel 3 (sí: no tiene sitio usable) o marcarse como bloqueado.
   */
  siteBroken?: boolean;
}

/** ¿Podemos pedir esta URL? */
export async function isAllowed(rawUrl: string): Promise<RobotsVerdict> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, delayMs: DEFAULT_DELAY_MS, reason: "url inválida" };
  }

  const policy = await loadPolicy(url.origin);
  if (policy.unavailable) {
    return {
      allowed: false,
      delayMs: policy.crawlDelayMs,
      reason: policy.unavailableReason ?? "no se pudo leer robots.txt",
      /** El sitio está roto, no es que nos hayan prohibido la entrada. */
      siteBroken: true,
    };
  }

  // Un Crawl-delay más largo de lo que estamos dispuestos a esperar equivale a
  // "no me visites": se saltea el sitio en vez de ignorarlo.
  if (policy.crawlDelayMs >= MAX_CRAWL_DELAY_MS) {
    return { allowed: false, delayMs: policy.crawlDelayMs, reason: "crawl-delay demasiado alto" };
  }

  const path = `${url.pathname}${url.search}`;
  let best: { rule: Rule; length: number } | null = null;
  for (const rule of policy.rules) {
    if (!patternToRegex(rule.path).test(path)) continue;
    const length = rule.path.length;
    // Gana la coincidencia más larga; ante empate, gana Allow.
    if (!best || length > best.length || (length === best.length && rule.allow)) {
      best = { rule, length };
    }
  }

  return {
    allowed: best ? best.rule.allow : true,
    delayMs: policy.crawlDelayMs,
    reason: best && !best.rule.allow ? `Disallow: ${best.rule.path}` : undefined,
  };
}

export { sleep };
