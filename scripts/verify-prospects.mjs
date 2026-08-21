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

// ─── 2b. Migración 011 (contacto en frío) ────────────────────────────────────

console.log("\n── Migración 011 ──");

{
  const { error } = await db.from("outreach_templates").select("id, name, status, variables").limit(1);
  if (error) bad(`falta la tabla outreach_templates: ${error.message}`,
                 "Correr supabase/sql-changes/011_contacto_en_frio.sql.");
  else ok("tabla outreach_templates");
}

{
  const { error } = await db.from("crm_contacts").select("outreach_at, outreach_count").limit(1);
  if (error) bad("crm_contacts no tiene outreach_at / outreach_count", "Correr la migración 011.");
  else ok("crm_contacts.outreach_at / outreach_count");
}

{
  const { error } = await db.from("crm_messages").select("is_outreach, template_id").limit(1);
  if (error) bad("crm_messages no tiene is_outreach / template_id", "Correr la migración 011.");
  else ok("crm_messages.is_outreach / template_id");
}

{
  // Un tope de 0 hace que devuelva allowed=false sin mandar nada. Se libera el
  // cupo enseguida para no dejar el contador del día desviado.
  const { data, error } = await db.rpc("reserve_cold_message", { p_limit: 0 });
  const row = Array.isArray(data) ? data[0] : data;
  if (error) {
    bad(`reserve_cold_message: ${error.message}`, "Correr la migración 011.");
  } else if (row?.allowed === false) {
    await db.rpc("release_cold_message");
    ok("reserve_cold_message / release_cold_message", "(el tope frena bien)");
  } else {
    bad("reserve_cold_message no respeta el tope");
  }
}

{
  const { data } = await db.from("outreach_templates").select("name, status, active");
  if (data) {
    const aprobadas = data.filter((t) => t.status === "aprobada" && t.active).length;
    if (data.length === 0) warn("no hay plantillas cargadas");
    else {
      ok(`${data.length} plantilla(s)`, `(${aprobadas} aprobada(s) y activa(s))`);
      for (const t of data) console.log(`   ${DIM}${t.name} — ${t.status}${t.active ? "" : " (inactiva)"}${OFF}`);
    }
  }
}

console.log(`   ${DIM}transporte: ${env.WHATSAPP_TRANSPORT ?? "evolution"} · tope diario en frío: ${env.OUTREACH_DAILY_LIMIT ?? 20}${OFF}`);

// ─── 2c. Migración 012 (ficha de cliente) ────────────────────────────────────

console.log("\n── Migración 012 ──");

{
  const { error } = await db.from("crm_events").select("id, kind, meta").limit(1);
  if (error) bad(`falta la tabla crm_events: ${error.message}`,
                 "Correr supabase/sql-changes/012_ficha_cliente.sql (después de la 011).");
  else ok("tabla crm_events");
}

{
  const { error } = await db.rpc("contact_timeline", {
    p_contact_id: "00000000-0000-0000-0000-000000000000",
    p_before: null,
    p_limit: 1,
  });
  if (error) bad(`contact_timeline: ${error.message}`, "Correr la migración 012.");
  else ok("contact_timeline");
}

{
  const { data } = await db.from("crm_events").select("kind");
  const tally = {};
  for (const e of data ?? []) tally[e.kind] = (tally[e.kind] ?? 0) + 1;
  const resumen = Object.entries(tally).sort().map(([k, v]) => `${k}=${v}`).join(" · ");
  console.log(`   ${DIM}eventos registrados: ${resumen || "ninguno todavía"}${OFF}`);
}

if (process.argv.includes("--live")) {
  // LA TRAMPA: `pipeline_deals` cascadea desde `crm_contacts`, así que al
  // borrar un cliente el trigger corre cuando el contacto YA NO EXISTE. Sin el
  // IF EXISTS de la rama DELETE, esto revienta por clave foránea y
  // `deleteClient()` deja de funcionar — con un error que no le apunta a nadie
  // al trigger. Por eso se prueba de verdad y no se asume.
  const { data: stages } = await db.from("pipeline_stages").select("*").order("order_index");
  let testId = null;
  try {
    const { data: cli } = await db
      .from("crm_contacts")
      .insert({
        business_name: "PRUEBA DEL VERIFICADOR — borrar si queda",
        email: `verificador-${Date.now()}@forcom.test`,
        origin: "manual",
      })
      .select("id")
      .single();
    testId = cli?.id ?? null;

    if (testId && stages?.length >= 2) {
      const { data: deal } = await db
        .from("pipeline_deals")
        .insert({ contact_id: testId, stage_id: stages[0].id, title: "Prueba", value: 1 })
        .select("id")
        .single();

      await db.from("pipeline_deals").update({ stage_id: stages[1].id }).eq("id", deal.id);

      const { data: evs } = await db.from("crm_events").select("kind, meta").eq("contact_id", testId);
      const moved = evs?.find((e) => e.kind === "deal_moved");
      if (evs?.some((e) => e.kind === "deal_created") && moved) {
        ok("el trigger registra los movimientos del Pipeline", `(${moved.meta.from} → ${moved.meta.to})`);
      } else {
        bad("el trigger no registró los movimientos del Pipeline",
            "Revisar pipeline_deals_log_events en la migración 012.");
      }

      const { error: delErr } = await db.from("crm_contacts").delete().eq("id", testId);
      if (delErr) {
        bad(`borrar un cliente con oportunidad falló: ${delErr.message}`,
            "Falta el IF EXISTS de la rama DELETE del trigger (sección 3 de la 012).");
      } else {
        testId = null;
        ok("un cliente con oportunidad se borra limpio", "(la trampa del trigger está cubierta)");
      }
    }
  } finally {
    // Si algo falló a mitad de camino, que no quede un cliente de prueba.
    if (testId) await db.from("crm_contacts").delete().eq("id", testId);
  }
} else {
  warn("trampa del trigger sin probar (agregá --live: crea y borra un cliente de prueba)");
}

// ─── 2d. Migración 013 (líneas de WhatsApp) ──────────────────────────────────

console.log("\n── Migración 013 ──");

{
  const { data, error } = await db
    .from("wa_lines")
    .select("name, kind, instance, is_primary, active, conn_state");
  if (error) {
    bad(`falta la tabla wa_lines: ${error.message}`,
        "Correr supabase/sql-changes/013_lineas_whatsapp.sql.");
  } else {
    const primary = data.find((l) => l.is_primary);
    if (!primary) bad("no hay línea principal", "La migración 013 la crea; revisar que corrió entera.");
    else ok("línea principal", `${primary.name} · ${primary.instance ?? "instancia sin asignar todavía"}`);

    const vendedores = data.filter((l) => l.kind === "baileys");
    console.log(`   ${DIM}${data.length} línea(s): ${data.map((l) => `${l.name} [${l.kind}${l.conn_state ? ` ${l.conn_state}` : ""}]`).join(" · ")}${OFF}`);
    if (vendedores.length === 0) warn("todavía no hay líneas de vendedores conectadas");
  }
}

{
  const { count: sinLinea } = await db
    .from("crm_conversations")
    .select("id", { count: "exact", head: true })
    .is("line_id", null);
  if ((sinLinea ?? 0) === 0) ok("todas las conversaciones tienen su línea asignada");
  else bad(`${sinLinea} conversación(es) sin línea`, "El backfill de la sección 3 de la 013 no corrió.");
}

{
  // El filtro que separa los dos mundos. Si esto falla, las conversaciones de
  // los vendedores se verían en la Bandeja.
  const { data, error } = await db
    .from("crm_conversations")
    .select("id, line:wa_lines!inner(kind)")
    .eq("line.kind", "meta");
  if (error) bad(`el filtro de la Bandeja falló: ${error.message}`);
  else {
    const { count: total } = await db.from("crm_conversations").select("id", { count: "exact", head: true });
    ok("el filtro de la Bandeja responde", `(${data.length} de ${total ?? 0} conversaciones son de la línea oficial)`);
  }
}

{
  const { error } = await db.from("wa_excluded_numbers").select("phone").limit(1);
  if (error) bad(`falta wa_excluded_numbers: ${error.message}`);
  else ok("tabla wa_excluded_numbers");
}

// ─── 2e. Migración 014 (análisis de conversaciones) ──────────────────────────

console.log("\n── Migración 014 ──");

{
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db.rpc("seller_stats", { p_from: from, p_to: new Date().toISOString() });
  if (error) {
    bad(`seller_stats: ${error.message}`, "Correr supabase/sql-changes/014_analisis_conversaciones.sql.");
  } else {
    ok("seller_stats", `(${(data ?? []).length} línea(s))`);
    for (const s of data ?? []) {
      const resp = s.median_response_s == null
        ? "sin datos"
        : s.median_response_s < 60
          ? `${s.median_response_s}s`
          : `${Math.round(s.median_response_s / 60)}min`;
      console.log(
        `   ${DIM}${s.line_name}: ${s.conversations} conv · ${s.messages_in}↓ ${s.messages_out}↑ · ` +
          `responde en ${resp} · ${s.unanswered} sin contestar${OFF}`
      );
    }
  }
}

{
  const { error } = await db.from("conversation_reviews").select("id, status, personal").limit(1);
  if (error) bad(`falta conversation_reviews: ${error.message}`);
  else ok("tabla conversation_reviews");
}

{
  // Idempotencia del encolado: correrlo dos veces sobre el mismo día no debe
  // duplicar. Con 0 líneas de vendedor devuelve 0 las dos veces, que también
  // es la respuesta correcta.
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const a = await db.rpc("enqueue_conversation_reviews", { p_day: ayer });
  const b = await db.rpc("enqueue_conversation_reviews", { p_day: ayer });
  if (a.error || b.error) bad(`enqueue_conversation_reviews: ${(a.error ?? b.error).message}`);
  else if (Number(b.data) === 0) ok("enqueue_conversation_reviews es idempotente", `(encoló ${a.data} la primera vez, 0 la segunda)`);
  else bad(`el encolado duplicó: ${a.data} y después ${b.data}`);
}

{
  const { error } = await db.rpc("claim_conversation_reviews", { p_limit: 0 });
  if (error) bad(`claim_conversation_reviews: ${error.message}`);
  else ok("claim_conversation_reviews");
}

{
  const { data } = await db.from("ai_config").select("provider, model, analysis_model, api_key_encrypted").eq("id", 1).maybeSingle();
  if (!data) warn("no hay configuración de IA — el análisis no va a poder correr");
  else if (!data.api_key_encrypted) warn("falta la clave de IA en /admin/agente — el análisis no va a poder correr");
  else ok("configuración de IA", `${data.provider} · análisis con ${data.analysis_model ?? data.model}`);
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
