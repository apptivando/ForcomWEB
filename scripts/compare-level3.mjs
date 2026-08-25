// ¿Cuánto aporta el nivel 3? Mide el antes y el después sobre los MISMOS
// prospectos.
//
//   node scripts/compare-level3.mjs --rubro "ferreterías" --locality "Córdoba Capital"
//   node scripts/compare-level3.mjs --search <uuid-de-una-búsqueda>
//   node scripts/compare-level3.mjs --rubro "ferreterías" --dry
//
// POR QUÉ SE PUEDE COMPARAR ASÍ
// El enriquecedor nunca pisa un dato que ya estaba: solo completa lo vacío. Así
// que volver a pasar los mismos comercios con el nivel 3 encendido SOLO puede
// sumar, nunca restar. Todo lo que aparezca de más es atribuible al nivel 3.
//
// ESCRIBE EN LA BASE DE VERDAD — es el punto. Con `--dry` solo muestra la foto
// del antes y a quién re-encolaría, sin tocar nada.
//
// LO QUE CUESTA
// Nada de Places (no busca, usa lo que ya está) y hasta 4 consultas de Serper
// por prospecto, que a ~USD 1 el millar son centavos. El tope diario de
// PROSPECT_SEARCH_DAILY_LIMIT sigue aplicando.

import { register } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
register("./ts-resolve-hook.mjs", import.meta.url);

// Igual que en e2e-prospects.mjs: los módulos de src/lib/prospects leen de
// process.env, que fuera de Next nadie llena.
for (const line of readFileSync(resolve(__dirname, "../.env.local"), "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

const lib = (f) => pathToFileURL(resolve(__dirname, "../src/lib", f)).href;
// `enrichContact` y no `enrichBatch`: el lote reclama de la cola GLOBAL, así
// que se llevaría por delante prospectos de otros rubros y el costo medido
// dejaría de ser el de este grupo. Acá se procesa exactamente la cohorte.
const { enrichContact } = await import(lib("prospects/enrich.ts"));
const { currentProvider, providerUnavailableReason, dailyLimit } = await import(lib("prospects/search.ts"));
const { formatArPhone } = await import(lib("phone.ts"));

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const OFF = "\x1b[0m";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const rubro = opt("rubro");
const locality = opt("locality");
const searchId = opt("search");
// Tope de prospectos a procesar. Sirve para una primera medición barata: con
// 20 ya se ve la tendencia y se gastan centavos.
const limite = opt("limit") ? Number(opt("limit")) : Infinity;
const dry = has("dry");

if (!rubro && !locality && !searchId) {
  console.log(`
${BOLD}Uso${OFF}
  node scripts/compare-level3.mjs --rubro "ferreterías" --locality "Córdoba Capital"
  node scripts/compare-level3.mjs --search <uuid>
  node scripts/compare-level3.mjs --rubro "ferreterías" --dry

${DIM}--rubro / --locality   elige el grupo de prospectos (uno de los dos alcanza)
--search               los de una búsqueda puntual (id de prospect_searches)
--limit N              procesa solo los primeros N (para una prueba barata)
--dry                  solo la foto del antes, sin tocar nada${OFF}
`);
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const CAMPOS =
  "id, business_name, phone, email, whatsapp_phone, whatsapp_source, website, " +
  "instagram_url, facebook_url, linkedin_url, contact_tier, enrichment_level, " +
  "enrichment_status, enrichment_error, scrape_attempts, manual_lock, notes";

/** Los prospectos del grupo elegido. */
async function cohorte() {
  if (searchId) {
    const { data: links, error } = await db
      .from("prospect_search_results")
      .select("contact_id")
      .eq("search_id", searchId);
    if (error) throw new Error(error.message);
    const ids = (links ?? []).map((l) => l.contact_id);
    if (ids.length === 0) return [];
    const { data, error: e2 } = await db.from("crm_contacts").select(CAMPOS).in("id", ids);
    if (e2) throw new Error(e2.message);
    return data ?? [];
  }

  let q = db.from("crm_contacts").select(CAMPOS).eq("origin", "busqueda");
  if (rubro) q = q.ilike("rubro", `%${rubro}%`);
  if (locality) q = q.ilike("locality", `%${locality}%`);
  const { data, error } = await q.limit(2000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Consultas de búsqueda gastadas hoy, según el contador atómico de la base. */
async function consultasDeHoy() {
  const { data } = await db
    .from("prospect_api_usage")
    .select("cse_queries")
    .eq("day", new Date().toISOString().slice(0, 10))
    .maybeSingle();
  return data?.cse_queries ?? 0;
}

function conteoPorTier(filas) {
  const c = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const f of filas) c[f.contact_tier] = (c[f.contact_tier] ?? 0) + 1;
  return c;
}

// ─── 1. La foto del antes ────────────────────────────────────────────────────

const antes = await cohorte();
if (antes.length === 0) {
  console.log(`${RED}✗${OFF} No hay prospectos que coincidan. Probá con otro rubro o localidad.`);
  process.exit(1);
}

const etiqueta = searchId ? `búsqueda ${searchId.slice(0, 8)}` : [rubro, locality].filter(Boolean).join(" · ");
console.log(`\n${BOLD}Grupo:${OFF} ${etiqueta} — ${antes.length} prospectos`);

const tierAntes = conteoPorTier(antes);
const previo = new Map(antes.map((c) => [c.id, c]));

// ─── 2. Quién vuelve a la cola ───────────────────────────────────────────────

// Solo los que todavía no tienen con qué contactarlos Y no llegaron al nivel 3.
// Los que ya tienen email + una vía de voz no van a gastar una consulta ni
// aunque se los encole: el gate del enriquecedor los corta igual. Encolarlos
// sería ensuciar la medición con prospectos que no participan.
const candidatos = antes.filter(
  (c) => !c.manual_lock && c.enrichment_level < 3 && !(c.email && (c.whatsapp_phone || c.phone))
);
const aReencolar = candidatos.slice(0, limite);

const yaListos = antes.length - candidatos.length;
console.log(
  `${DIM}${yaListos} ya tienen email + una vía de voz (no participan) · ` +
    `${candidatos.length} pueden mejorar` +
    (aReencolar.length < candidatos.length ? ` · se procesan ${aReencolar.length} por --limit` : "") +
    OFF
);

if (aReencolar.length === 0) {
  console.log(`\n${GREEN}✓${OFF} No hay nada que el nivel 3 pueda mejorar en este grupo.`);
  process.exit(0);
}

// El estado del proveedor, ANTES de gastar: si está apagado, la medición
// entera daría "no mejoró" por un motivo que no es el nivel 3.
const proveedor = currentProvider();
console.log(`${DIM}Nivel 3: proveedor "${proveedor}" · tope de hoy ${dailyLimit()} consultas${OFF}`);
if (proveedor === "off") {
  console.log(
    `\n${RED}✗${OFF} El nivel 3 está apagado (PROSPECT_SEARCH_PROVIDER=off).\n` +
      `  Medir así no compara nada. Poné ${BOLD}PROSPECT_SEARCH_PROVIDER=serper${OFF} en .env.local.`
  );
  process.exit(1);
}

// Aviso, no problema: la cola general la sigue vaciando el cron por su cuenta.
// Importa saberlo porque comparte el tope diario de consultas con esta medición.
const { count: pendientesAjenos } = await db
  .from("crm_contacts")
  .select("id", { count: "exact", head: true })
  .in("enrichment_status", ["pending", "running"]);
if (pendientesAjenos > 0) {
  console.log(
    `${YELLOW}!${OFF} ${DIM}Hay ${pendientesAjenos} prospectos en la cola general. ` +
      `Este script no los toca, pero si el cron corre en paralelo comparten el ` +
      `tope diario de ${dailyLimit()} consultas.${OFF}`
  );
}

if (dry) {
  console.log(`\n${BOLD}Foto del antes${OFF}`);
  console.table(
    [1, 2, 3, 4].map((t) => ({
      prioridad: t,
      significa: ["WhatsApp", "email", "solo teléfono", "sin contacto"][t - 1],
      cantidad: tierAntes[t],
    }))
  );
  console.log(`${DIM}--dry: no se tocó nada. Sacá la bandera para correr de verdad.${OFF}`);
  process.exit(0);
}

// ─── 3. Enriquecer, solo la cohorte ──────────────────────────────────────────

// Los intentos vuelven a cero: varios de estos ya se procesaron sin nivel 3 y
// arrastran intentos gastados. `enrichContact` lee `scrape_attempts` del objeto
// que recibe, así que se resetea también en memoria.
const { error: reqError } = await db
  .from("crm_contacts")
  .update({ enrichment_status: "running", enrichment_error: null, scrape_attempts: 0 })
  .in("id", aReencolar.map((c) => c.id));
if (reqError) throw new Error(`no se pudo re-encolar: ${reqError.message}`);

const consultasAntes = await consultasDeHoy();
const arranque = Date.now();
const tope = dailyLimit();
let procesados = 0;
let quotaAgotada = false;

// El mismo contador atómico que usa el worker: vive en la base porque el cron
// es serverless y no tiene estado entre invocaciones. Acá se reusa para que la
// medición consuma del mismo tope y no se escape por un costado.
const onQuota = async () => {
  if (quotaAgotada) return false;
  const { data } = await db.rpc("bump_cse_usage", { p_limit: tope });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    quotaAgotada = true;
    return false;
  }
  return true;
};

console.log(`\n${DIM}Enriqueciendo ${aReencolar.length}… (visita sitios reales, tarda)${OFF}`);

for (const contact of aReencolar) {
  await enrichContact(db, { ...contact, scrape_attempts: 0 }, onQuota);
  procesados++;
  process.stdout.write(`\r  ${procesados}/${aReencolar.length}      `);
  if (quotaAgotada) {
    console.log(`\n${YELLOW}!${OFF} Se agotó el tope diario de consultas (${tope}). El resto queda para mañana.`);
    break;
  }
}
console.log("");

// Lo que no se llegó a procesar vuelve a 'pending' para que lo tome el cron —
// si quedara en 'running', el watchdog tardaría 15 minutos en rescatarlo.
const sinProcesar = aReencolar.slice(procesados).map((c) => c.id);
if (sinProcesar.length > 0) {
  await db.from("crm_contacts").update({ enrichment_status: "pending" }).in("id", sinProcesar);
}

const consultasGastadas = (await consultasDeHoy()) - consultasAntes;
const segundos = (Date.now() - arranque) / 1000;

// ─── 4. La foto del después ──────────────────────────────────────────────────

const despues = await cohorte();
const tierDespues = conteoPorTier(despues);

const SIGNIFICA = ["WhatsApp confirmado", "email", "solo teléfono", "sin contacto"];

console.log(`\n${BOLD}Antes y después${OFF}`);
console.table(
  [1, 2, 3, 4].map((t) => {
    const d = tierDespues[t] - tierAntes[t];
    return {
      prioridad: t,
      significa: SIGNIFICA[t - 1],
      antes: tierAntes[t],
      después: tierDespues[t],
      cambio: d === 0 ? "—" : d > 0 ? `+${d}` : `${d}`,
    };
  })
);

// El detalle de los que se movieron. Lo que importa mirar a mano son los
// emails: un correo sacado de una guía desactualizada puede ser de otra
// empresa, y el riesgo del extractor nunca fue no encontrar sino inventar.
const cambios = [];
for (const c of despues) {
  const a = previo.get(c.id);
  if (!a) continue;
  const nuevo = {};
  if (c.email && !a.email) nuevo.email = c.email;
  if (c.whatsapp_phone && !a.whatsapp_phone) nuevo.whatsapp = `${formatArPhone(c.whatsapp_phone)} (${c.whatsapp_source})`;
  if (c.phone && !a.phone) nuevo.tel = formatArPhone(c.phone);
  if (c.instagram_url && !a.instagram_url) nuevo.instagram = c.instagram_url;
  if (c.facebook_url && !a.facebook_url) nuevo.facebook = c.facebook_url;
  if (Object.keys(nuevo).length === 0) continue;

  cambios.push({
    comercio: (c.business_name ?? "").slice(0, 28),
    sitio: c.website ? "sí" : "no",
    email: nuevo.email ?? "",
    whatsapp: nuevo.whatsapp ?? "",
    tel: nuevo.tel ?? "",
    redes: [nuevo.instagram && "IG", nuevo.facebook && "FB"].filter(Boolean).join("+"),
    prioridad: `${a.contact_tier} → ${c.contact_tier}`,
    nivel: c.enrichment_level,
  });
}

if (cambios.length > 0) {
  console.log(`\n${BOLD}Lo que se consiguió${OFF} ${DIM}(la columna "sitio" dice si ya tenía web: los "no" son los que solo pudo resolver el nivel 3)${OFF}`);
  console.table(cambios);
} else {
  console.log(`\n${YELLOW}Ningún prospecto sumó datos.${OFF}`);
}

// Los que siguen sin nada, con el motivo. Es la lista para trabajar a mano.
const sinNada = despues.filter((c) => c.contact_tier === 4 || (c.contact_tier === 3 && !c.email));
if (sinNada.length > 0) {
  console.log(`\n${BOLD}Los que siguen sin correo${OFF} ${DIM}(${sinNada.length})${OFF}`);
  console.table(
    sinNada.slice(0, 15).map((c) => ({
      comercio: (c.business_name ?? "").slice(0, 28),
      tel: c.phone ? formatArPhone(c.phone) : "—",
      sitio: c.website ? "sí" : "no",
      redes: [c.instagram_url && "IG", c.facebook_url && "FB"].filter(Boolean).join("+") || "—",
      nivel: c.enrichment_level,
      problema: (c.enrichment_error ?? "").slice(0, 45) || "—",
    }))
  );
  if (sinNada.length > 15) console.log(`${DIM}  …y ${sinNada.length - 15} más${OFF}`);
}

// ─── 5. Lo que costó ─────────────────────────────────────────────────────────

const ganaronAlgo = cambios.length;
const salieronDe3y4 = tierAntes[3] + tierAntes[4] - (tierDespues[3] + tierDespues[4]);
const conEmailAntes = antes.filter((c) => c.email).length;
const conEmailDespues = despues.filter((c) => c.email).length;

console.log(`\n${BOLD}El resultado${OFF}`);
console.log(`  ${GREEN}✓${OFF} ${ganaronAlgo} de ${aReencolar.length} prospectos sumaron algún dato`);
console.log(`  ${GREEN}✓${OFF} ${conEmailDespues - conEmailAntes} correos nuevos (${conEmailAntes} → ${conEmailDespues})`);
console.log(`  ${GREEN}✓${OFF} ${salieronDe3y4} salieron de "solo teléfono" o "sin contacto"`);
console.log(
  `\n  Consultas gastadas: ${BOLD}${consultasGastadas}${OFF} · ` +
    `costo aproximado ${BOLD}USD ${(consultasGastadas / 1000).toFixed(3)}${OFF} ${DIM}(Serper, ~USD 1 el millar)${OFF}`
);
console.log(
  `  Tiempo: ${segundos.toFixed(0)} s en total · ` +
    `${procesados ? (segundos / procesados).toFixed(1) : "—"} s por prospecto ${DIM}(el cron da 40 s cada uno)${OFF}`
);
if (providerUnavailableReason()) console.log(`  ${RED}${providerUnavailableReason()}${OFF}`);

console.log(
  `\n${YELLOW}Antes de mandarles nada${OFF}, revisá a mano los correos nuevos: uno sacado de ` +
    `\n  una guía desactualizada puede ser de otra empresa.`
);

// La foto queda en disco para poder volver a comparar más adelante.
const outDir = resolve(__dirname, "../.compare");
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, `level3-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`);
writeFileSync(
  out,
  JSON.stringify(
    { etiqueta, cuando: new Date().toISOString(), tierAntes, tierDespues, consultasGastadas, segundos, cambios },
    null,
    2
  )
);
console.log(`${DIM}\nDetalle guardado en ${out.replace(resolve(__dirname, ".."), ".")}${OFF}`);
