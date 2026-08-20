// Prueba de punta a punta del scraper, sin levantar la app.
//
//   node scripts/e2e-prospects.mjs "ferreterías" "Córdoba Capital" [--max 20] [--enrich 6]
//
// Hace lo mismo que el botón "Buscar" de /admin/clientes y después corre un
// lote de enriquecimiento, mostrando qué encontró cada prospecto. Escribe en la
// base de verdad — es el punto.
//
// Cuesta una llamada a Places por cada 20 resultados (~USD 0,028 por 1.000).

import { register } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
register("./ts-resolve-hook.mjs", import.meta.url);

// Las variables se cargan a mano y se meten en process.env porque los módulos
// de src/lib/prospects las leen de ahí (corren en el server de Next, que sí
// las carga solo).
for (const line of readFileSync(resolve(__dirname, "../.env.local"), "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

const lib = (f) => pathToFileURL(resolve(__dirname, "../src/lib", f)).href;
const { searchPlaces } = await import(lib("prospects/places.ts"));
const { classifyUrl } = await import(lib("prospects/urls.ts"));
const { toE164Ar, formatArPhone } = await import(lib("phone.ts"));
const { enrichBatch } = await import(lib("prospects/enrich.ts"));
const { currentProvider, providerUnavailableReason } = await import(lib("prospects/search.ts"));

const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const OFF = "\x1b[0m";

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : Number(args[i + 1]);
};
const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const rubro = positional[0] ?? "ferreterías";
const locality = positional[1] ?? "Córdoba Capital";
const maxResults = flag("max", 20);
const enrichCount = flag("enrich", 6);

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─── 1. Búsqueda ─────────────────────────────────────────────────────────────

const query = `${rubro} en ${locality}, Argentina`;
console.log(`\n${DIM}Buscando: ${query} (hasta ${maxResults})${OFF}`);

const { data: search } = await db
  .from("prospect_searches")
  .insert({ rubro, locality, query, status: "running" })
  .select("id")
  .single();

const places = await searchPlaces({ query, maxResults });
const open = places.filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY");

const items = open.map((p) => {
  const parsed = toE164Ar(p.internationalPhone ?? p.nationalPhone ?? "");
  const site = classifyUrl(p.website);
  return {
    place_id: p.id,
    name: p.name,
    phone: parsed?.e164 ?? null,
    wa_likely: parsed?.isMobile ?? false,
    address: p.address,
    website: site.kind === "web" || site.kind === "linkinbio" ? site.url : null,
    instagram: site.kind === "instagram" ? site.url : null,
    facebook: site.kind === "facebook" ? site.url : null,
    linkedin: site.kind === "linkedin" ? site.url : null,
    maps_url: p.mapsUrl,
    rating: p.rating,
    reviews: p.reviewsCount,
    rubro: p.primaryType ?? rubro,
    locality,
  };
});

// La RPC de lote tiene un guard que exige sesión de admin; desde un script con
// la service key no hay sesión, así que se llama a upsert_prospect uno por uno
// (que es la misma función, sin el guard del envoltorio).
let created = 0;
for (const it of items) {
  const { data, error } = await db.rpc("upsert_prospect", {
    p_search_id: search.id,
    p_place_id: it.place_id,
    p_name: it.name,
    p_phone: it.phone,
    p_wa_likely: it.wa_likely,
    p_address: it.address,
    p_website: it.website,
    p_maps_url: it.maps_url,
    p_rating: it.rating,
    p_reviews: it.reviews,
    p_rubro: it.rubro,
    p_locality: it.locality,
    p_instagram: it.instagram,
    p_facebook: it.facebook,
    p_linkedin: it.linkedin,
  });
  if (error) {
    console.log(`  ✗ ${it.name}: ${error.message}`);
    continue;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.was_new) created++;
}

await db
  .from("prospect_searches")
  .update({ status: "done", results_count: items.length, new_count: created, finished_at: new Date().toISOString() })
  .eq("id", search.id);

console.log(
  `${GREEN}✓${OFF} ${places.length} de Google · ${places.length - open.length} cerrados descartados · ` +
    `${items.length} guardados · ${created} nuevos · ${items.length - created} fusionados con fichas existentes`
);

// ─── 2. Enriquecimiento ──────────────────────────────────────────────────────

console.log(`\n${DIM}Nivel 3 (búsqueda web): proveedor "${currentProvider()}"${OFF}`);
console.log(`${DIM}Enriqueciendo ${enrichCount}… (visita sitios reales, tarda)${OFF}\n`);

const result = await enrichBatch(db, { limit: enrichCount, deadline: Date.now() + 280_000 });

const ids = result.outcomes.map((o) => o.contactId);
const { data: after } = await db
  .from("crm_contacts")
  .select("business_name, phone, email, whatsapp_phone, whatsapp_source, website, instagram_url, facebook_url, contact_tier, enrichment_level, enrichment_status, enrichment_error")
  .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

console.table(
  (after ?? [])
    .sort((a, b) => a.contact_tier - b.contact_tier)
    .map((c) => ({
      prioridad: c.contact_tier,
      comercio: (c.business_name ?? "").slice(0, 30),
      whatsapp: c.whatsapp_phone ? `${formatArPhone(c.whatsapp_phone)} (${c.whatsapp_source})` : "—",
      email: c.email ?? "—",
      tel: c.phone ? formatArPhone(c.phone) : "—",
      redes: [c.instagram_url && "IG", c.facebook_url && "FB"].filter(Boolean).join("+") || "—",
      nivel: c.enrichment_level,
      problema: (c.enrichment_error ?? "").slice(0, 40) || "—",
    }))
);

console.log(
  `${GREEN}✓${OFF} ${result.processed} procesados · ` +
    `${result.found.email} con email nuevo · ${result.found.whatsapp} con WhatsApp confirmado` +
    (result.requeued ? ` · ${result.requeued} rescatados de una corrida colgada` : "")
);
if (providerUnavailableReason()) console.log(`  ${DIM}${providerUnavailableReason()}${OFF}`);

const { count: pending } = await db
  .from("crm_contacts")
  .select("id", { count: "exact", head: true })
  .in("enrichment_status", ["pending", "running"]);
console.log(`${DIM}Quedan ${pending ?? 0} en la cola.${OFF}`);
