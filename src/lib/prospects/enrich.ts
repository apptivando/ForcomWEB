/**
 * Enriquecedor de prospectos: la cascada de cuatro niveles.
 *
 *   Nivel 0  Google Places        → nombre, dirección, teléfono, sitio, rating
 *      ↓  (si ya hay email y WhatsApp, corta)
 *   Nivel 1  Sitio web propio     → home + hasta 3 páginas · email, WA, redes
 *      ↓  (si no hay sitio, o el sitio no dio nada)
 *   Nivel 2  Redes enlazadas      → NO se visitan. Solo se guarda la URL.
 *      ↓
 *   Nivel 3  Google Search (CSE)  → snippets + hasta 2 directorios
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
} from "./extract";
import { webSearch, buildQueries, searchConfigured, dailyLimit, SearchQuotaExceeded } from "./search";
import { toWhatsappNumber } from "@/lib/phone";
import type { CrmContact } from "@/lib/types";

/** Páginas máximas por sitio (la home cuenta como una). */
const MAX_PAGES_PER_SITE = 4;
/** Presupuesto de tiempo por prospecto, para que un lote no se pase del límite. */
const SITE_BUDGET_MS = 20_000;
/** Resultados de búsqueda que se abren como máximo en el nivel 3. */
const MAX_SEARCH_VISITS = 2;

/**
 * Dominios de directorios comerciales argentinos. Se prioriza abrirlos cuando
 * el snippet no alcanzó: son los que publican el email que el comercio no pone
 * en ningún otro lado.
 */
const DIRECTORY_DOMAINS = [
  "paginasamarillas.com.ar", "cylex.com.ar", "guialocal.com.ar",
  "infoisinfo.com.ar", "opendi.com.ar", "tuugo.com.ar",
  "hotfrog.com.ar", "yalwa.com.ar", "dateas.com",
];

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

/** ¿Ya alcanzó? El objetivo es email + WhatsApp; con los dos no se sigue gastando. */
function isSatisfied(f: Findings): boolean {
  return Boolean(f.email && f.whatsapp);
}

/** Vuelca lo encontrado en una página sobre el acumulado, sin pisar lo que ya había. */
function absorb(
  f: Findings,
  html: string,
  opts: { siteDomain?: string; fromContactPage?: boolean; waSource?: "link" | "texto" | "busqueda" }
): void {
  if (!f.email) {
    const best = extractEmails(html, opts)[0];
    if (best) f.email = best.email;
  }

  if (!f.whatsapp) {
    const wa = extractWhatsapp(html);
    if (wa?.phone) {
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
    const best = extractPhones(html)[0];
    if (best) f.phoneE164 = best.e164;
  }

  const socials = extractSocials(html);
  f.instagram ??= socials.instagram;
  f.facebook ??= socials.facebook;
  f.linkedin ??= socials.linkedin;
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

  const started = Date.now();
  const siteDomain = registrableDomain(site.host);
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
    absorb(f, res.ok.body, { siteDomain, fromContactPage: next.isContactPage });
    if (res.ok.truncated) f.notes.push("la página era muy grande y se leyó parcial");

    if (isSatisfied(f)) break;

    // Solo desde la home se eligen más páginas: seguir links desde una página
    // interna llevaría a recorrer el sitio entero.
    if (visited.size === 1) {
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

  const nationalPhone = contact.phone?.replace(/^54(9)?/, "") ?? null;
  const queries = buildQueries({
    businessName: contact.business_name,
    locality: contact.locality,
    nationalPhone,
  });
  if (queries.length === 0) return { error: null, quotaHit: false };

  const ownDomain = contact.website ? registrableDomain(classifyUrl(contact.website).host ?? "") : null;
  const candidates: string[] = [];

  for (const query of queries) {
    let hits;
    try {
      hits = await webSearch(query, { onQuota });
    } catch (err) {
      if (err instanceof SearchQuotaExceeded) return { error: null, quotaHit: true };
      return { error: err instanceof Error ? err.message : "búsqueda fallida", quotaHit: false };
    }

    f.level = Math.max(f.level, 3);

    for (const hit of hits) {
      // Lo primero y lo más barato: el resumen que Google ya indexó. Para los
      // perfiles de redes esto es TODO lo que hacemos — el link nunca se abre.
      absorb(f, `${hit.title} ${hit.snippet} ${hit.structured} ${hit.url}`, {
        waSource: "busqueda",
      });

      const kind = classifyUrl(hit.url);
      if (kind.kind === "web" && kind.host) {
        const domain = registrableDomain(kind.host);
        if (domain !== ownDomain) {
          const isDirectory = DIRECTORY_DOMAINS.includes(domain);
          if (isDirectory) candidates.unshift(hit.url);
          else candidates.push(hit.url);
        }
      }
    }

    if (isSatisfied(f)) return { error: null, quotaHit: false };
  }

  // Si el resumen no alcanzó, se abren hasta dos resultados. Nunca una red
  // social: solo directorios y sitios propios de comercios.
  let visits = 0;
  for (const url of candidates) {
    if (visits >= MAX_SEARCH_VISITS || isSatisfied(f)) break;

    const verdict = await isAllowed(url);
    if (!verdict.allowed) continue;

    const res = await fetchHtml(url);
    if (!res.ok) continue;

    visits++;
    absorb(f, res.ok.body, { waSource: "busqueda" });
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

    // El nivel 3 solo se gasta en quien todavía no tiene forma de contacto.
    // Nunca en todos: es lo que mantiene el costo dentro de lo gratuito.
    const stillMissing = !f.email && !f.whatsapp && !contact.email && !contact.whatsapp_phone;
    if (stillMissing) {
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
