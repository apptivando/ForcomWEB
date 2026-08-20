// Verificación de punta a punta del scraper de prospectos.
//
//   node scripts/verify-prospects.mjs           → solo chequeos (no escribe nada)
//   node scripts/verify-prospects.mjs --live    → además hace una búsqueda real
//                                                 en Google Places (cuesta 1 llamada)
//
// Comprueba, en este orden: que la migración 010 esté corrida, que las
// funciones existan y se comporten, que las variables estén cargadas, y que las
// dos APIs de Google respondan. Cada chequeo dice qué hacer si falla.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const OFF = "\x1b[0m";

let failed = 0;
function ok(msg, detail) {
  console.log(`${GREEN}✓${OFF} ${msg}${detail ? ` ${DIM}${detail}${OFF}` : ""}`);
}
function bad(msg, fix) {
  failed++;
  console.log(`${RED}✗${OFF} ${msg}`);
  if (fix) console.log(`   ${YELLOW}→ ${fix}${OFF}`);
}
function warn(msg) {
  console.log(`${YELLOW}!${OFF} ${msg}`);
}

// ─── 1. Esquema ──────────────────────────────────────────────────────────────

console.log("\n── Migración 010 ──");

const NEW_COLUMNS = [
  "contact_name", "business_name", "origin", "email", "rubro", "locality",
  "address", "website", "instagram_url", "facebook_url", "linkedin_url",
  "google_place_id", "google_maps_url", "google_synced_at", "rating",
  "reviews_count", "whatsapp_phone", "whatsapp_source", "whatsapp_likely",
  "enrichment_status", "enrichment_level", "scrape_attempts", "manual_lock",
  "notes", "contact_tier",
];

{
  const { data, error } = await db.from("crm_contacts").select(NEW_COLUMNS.join(",")).limit(1);
  if (error) {
    bad(`crm_contacts no tiene las columnas nuevas: ${error.message}`,
        "Correr supabase/sql-changes/010_clientes_unificados.sql en el SQL Editor.");
  } else {
    ok(`crm_contacts tiene las ${NEW_COLUMNS.length} columnas nuevas`);
  }
  void data;
}

{
  // `name` tiene que haber desaparecido: si sigue, el rename no corrió y el
  // webhook estaría escribiendo en una columna muerta.
  const { error } = await db.from("crm_contacts").select("name").limit(1);
  if (error) ok("la columna vieja `name` ya no existe", "(se renombró a contact_name)");
  else bad("`name` todavía existe: el rename de la sección 1 no se aplicó",
           "Revisar que el bloque DO $$ ... $$ de la migración haya corrido sin error.");
}

for (const table of ["prospect_searches", "prospect_search_results", "prospect_api_usage"]) {
  const { error } = await db.from(table).select("*").limit(1);
  if (error) bad(`falta la tabla ${table}: ${error.message}`, "Correr la migración 010 completa.");
  else ok(`tabla ${table}`);
}

{
  const { error } = await db.from("contact_messages").select("contact_id").limit(1);
  if (error) bad("contact_messages no tiene contact_id (fase 7)", "Correr la sección 13 de la migración.");
  else ok("contact_messages.contact_id (fase 7)");
}

// ─── 2. Funciones ────────────────────────────────────────────────────────────

console.log("\n── Funciones ──");

{
  // Reclamar 0 prospectos: no cambia nada pero prueba que la función exista y
  // que la service key tenga permiso de ejecutarla.
  const { error } = await db.rpc("claim_prospects_for_enrichment", { p_limit: 0 });
  if (error) bad(`claim_prospects_for_enrichment: ${error.message}`,
                 "Revisar los GRANT de la sección 10 de la migración.");
  else ok("claim_prospects_for_enrichment");
}

{
  const { error } = await db.rpc("requeue_stale_enrichments");
  if (error) bad(`requeue_stale_enrichments: ${error.message}`);
  else ok("requeue_stale_enrichments");
}

{
  // upsert_prospects con lista vacía: prueba la firma sin escribir nada.
  // Con la service key el guard de current_admin_role() rechaza, y eso también
  // es una verificación válida: la función existe y protege.
  const { error } = await db.rpc("upsert_prospects", { p_search_id: null, p_items: [] });
  if (!error) ok("upsert_prospects", "(sin guard: la llamó la service key)");
  else if (/no autorizado/i.test(error.message)) ok("upsert_prospects", "(existe y su guard funciona)");
  else bad(`upsert_prospects: ${error.message}`, "Revisar la sección 8 de la migración.");
}

{
  // Un tope de 0 hace que la respuesta sea `allowed: false` sin gastar cuota
  // real de Google, pero SÍ incrementa el contador del día en 1.
  const { data, error } = await db.rpc("bump_cse_usage", { p_limit: 0 });
  const row = Array.isArray(data) ? data[0] : data;
  if (error) bad(`bump_cse_usage: ${error.message}`);
  else if (row?.allowed === false) ok("bump_cse_usage", `(contador del día: ${row.used})`);
  else bad("bump_cse_usage no respeta el tope");
}

// ─── 3. Datos ────────────────────────────────────────────────────────────────

console.log("\n── Estado de los datos ──");

{
  const { data, error } = await db.from("crm_contacts").select("origin, contact_tier");
  if (error) {
    bad(`no se pudo leer crm_contacts: ${error.message}`);
  } else {
    const counts = {};
    for (const r of data) {
      const key = `${r.origin} / prioridad ${r.contact_tier}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    if (data.length === 0) warn("crm_contacts está vacía (todavía no hay clientes)");
    else {
      ok(`${data.length} clientes`);
      for (const [k, v] of Object.entries(counts).sort()) console.log(`   ${DIM}${k}: ${v}${OFF}`);
    }
  }
}

{
  const { count } = await db
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .is("contact_id", null);
  if ((count ?? 0) === 0) ok("todos los mensajes del formulario tienen su ficha de cliente");
  else warn(`${count} mensajes del formulario sin ficha (el backfill no los pudo matchear)`);
}

{
  const { count } = await db
    .from("crm_contacts")
    .select("id", { count: "exact", head: true })
    .in("enrichment_status", ["pending", "running"]);
  console.log(`   ${DIM}cola de enriquecimiento: ${count ?? 0}${OFF}`);
}

// ─── 4. APIs de Google ───────────────────────────────────────────────────────

console.log("\n── Google ──");

if (!env.GOOGLE_PLACES_API_KEY) {
  bad("falta GOOGLE_PLACES_API_KEY");
} else if (process.argv.includes("--live")) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.internationalPhoneNumber,places.websiteUri,nextPageToken",
    },
    body: JSON.stringify({
      textQuery: "ferreterías en Córdoba, Argentina",
      languageCode: "es",
      regionCode: "AR",
      pageSize: 3,
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    bad(`Places API ${res.status}: ${JSON.stringify(body).slice(0, 200)}`,
        res.status === 403
          ? "Habilitar 'Places API (New)' en Google Cloud y revisar las restricciones de la key."
          : "Revisar el FieldMask y los parámetros.");
  } else {
    const places = body.places ?? [];
    ok(`Places API responde`, `(${places.length} resultados, ${places.filter((p) => p.websiteUri).length} con sitio web)`);
    for (const p of places) {
      console.log(`   ${DIM}${p.displayName?.text} · ${p.internationalPhoneNumber ?? "sin tel"} · ${p.websiteUri ?? "sin sitio"}${OFF}`);
    }
  }
} else {
  warn("Places API sin probar (agregá --live para hacer una búsqueda real)");
}

const provider = (env.PROSPECT_SEARCH_PROVIDER ?? "").trim().toLowerCase();

if (provider === "off" || (!provider && !env.SERPER_API_KEY && !env.BRAVE_SEARCH_API_KEY)) {
  warn(
    "nivel 3 apagado (PROSPECT_SEARCH_PROVIDER=off). Google cerró su Custom Search JSON API " +
      "a proyectos nuevos; para encenderlo hace falta serper o brave."
  );
} else if (provider === "serper") {
  if (env.SERPER_API_KEY) ok("nivel 3: proveedor serper con credencial cargada");
  else bad("PROSPECT_SEARCH_PROVIDER=serper pero falta SERPER_API_KEY");
} else if (provider === "brave") {
  if (env.BRAVE_SEARCH_API_KEY) ok("nivel 3: proveedor brave con credencial cargada");
  else bad("PROSPECT_SEARCH_PROVIDER=brave pero falta BRAVE_SEARCH_API_KEY");
} else if (!env.GOOGLE_CSE_API_KEY || !env.GOOGLE_CSE_CX) {
  warn("nivel 3 apagado: no hay credenciales de ningún proveedor de búsqueda");
} else if (process.argv.includes("--live")) {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", env.GOOGLE_CSE_API_KEY);
  url.searchParams.set("cx", env.GOOGLE_CSE_CX);
  url.searchParams.set("q", "ferretería Córdoba");
  url.searchParams.set("num", "5");
  url.searchParams.set("hl", "es");
  url.searchParams.set("gl", "ar");
  url.searchParams.set("safe", "off");

  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    bad(`Custom Search ${res.status}: ${JSON.stringify(body.error?.message ?? body).slice(0, 200)}`,
        res.status === 403
          ? "Google cerró esta API a clientes nuevos: no se arregla habilitándola. Poner PROSPECT_SEARCH_PROVIDER=off, o contratar serper/brave."
          : "Revisar la key y el cx.");
  } else {
    const items = body.items ?? [];
    if (items.length === 0) {
      warn("Custom Search responde pero no devolvió resultados — revisar que el buscador tenga cargados los dominios");
    } else {
      ok(`Custom Search responde`, `(${items.length} resultados)`);
      const hosts = [...new Set(items.map((i) => new URL(i.link).hostname.replace(/^www\./, "")))];
      console.log(`   ${DIM}dominios: ${hosts.join(", ")}${OFF}`);
    }
  }
} else {
  warn("Custom Search sin probar (agregá --live)");
}

// ─── Resumen ─────────────────────────────────────────────────────────────────

console.log(
  failed === 0
    ? `\n${GREEN}Todo en orden.${OFF}`
    : `\n${RED}${failed} verificación(es) fallaron.${OFF}`
);
process.exitCode = failed === 0 ? 0 : 1;
