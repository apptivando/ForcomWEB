// Vacía la cola de enriquecimiento de una sentada, sin esperar al cron.
//
//   node scripts/drain-queue.mjs             # todo lo pendiente
//   node scripts/drain-queue.mjs --limit 50  # solo los primeros 50
//   node scripts/drain-queue.mjs --dry       # cuántos hay y qué pinta tienen
//
// POR QUÉ EXISTE
// El cron de GitHub Actions está declarado cada 5 minutos, pero GitHub
// **no lo cumple**: medido sobre este repo, dispara cada 50-80 minutos y
// procesa entre 2 y 6 prospectos por vez. Eso son ~4 por hora, o sea que una
// búsqueda de 60 tarda medio día y un backlog de 200 tarda dos días.
//
// GitHub lo dice en su documentación —los `schedule` de intervalo corto se
// posponen o se saltean bajo carga— y no hay forma de apurarlo desde acá. Así
// que para cargar una tanda grande, esto: mismo código que el cron, sin la
// espera.
//
// Escribe en la base de verdad. Respeta `manual_lock` y el tope diario de
// consultas de búsqueda, igual que el worker.

import { register } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
register("./ts-resolve-hook.mjs", import.meta.url);

for (const line of readFileSync(resolve(__dirname, "../.env.local"), "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

const lib = (f) => pathToFileURL(resolve(__dirname, "../src/lib", f)).href;
const { enrichContact } = await import(lib("prospects/enrich.ts"));
const { currentProvider, dailyLimit } = await import(lib("prospects/search.ts"));

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const OFF = "\x1b[0m";

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i === -1 ? null : args[i + 1]; };
const limite = opt("limit") ? Number(opt("limit")) : Infinity;
const dry = args.includes("--dry");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// Las mismas condiciones que `claim_prospects_for_enrichment`: nada con candado
// manual y nada que ya haya gastado sus tres intentos.
const { data: cola, error } = await db
  .from("crm_contacts")
  .select("*")
  .eq("enrichment_status", "pending")
  .eq("manual_lock", false)
  .lt("scrape_attempts", 3)
  .order("created_at")
  .limit(Number.isFinite(limite) ? limite : 2000);
if (error) throw new Error(error.message);

const conWeb = cola.filter((c) => c.website).length;
console.log(`\n${BOLD}${cola.length} prospectos en la cola${OFF}`);
console.log(`${DIM}${conWeb} tienen sitio web propio (de ahí salen casi todos los correos) · ${cola.length - conWeb} no${OFF}`);
console.log(`${DIM}nivel 3: proveedor "${currentProvider()}" · tope de hoy ${dailyLimit()} consultas${OFF}`);

if (dry || cola.length === 0) {
  if (dry) console.log(`${DIM}--dry: no se tocó nada.${OFF}`);
  process.exit(0);
}

// El mismo contador atómico del worker, para que esto consuma del mismo tope.
const tope = dailyLimit();
let quotaAgotada = false;
const onQuota = async () => {
  if (quotaAgotada) return false;
  const { data } = await db.rpc("bump_cse_usage", { p_limit: tope });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) { quotaAgotada = true; return false; }
  return true;
};

const t0 = Date.now();
let hechos = 0;
let conEmail = 0;
let conWhatsapp = 0;

for (const c of cola) {
  // `scrape_attempts: 0` en memoria y no en la base: si el proceso se corta a
  // la mitad, lo que no se llegó a procesar queda como estaba.
  const r = await enrichContact(db, c, onQuota);
  hechos++;
  if (r.found.email) conEmail++;
  if (r.found.whatsapp) conWhatsapp++;

  const seg = (Date.now() - t0) / 1000;
  const faltan = Math.round(((seg / hechos) * (cola.length - hechos)) / 60);
  process.stdout.write(
    `\r  ${hechos}/${cola.length} · ${conEmail} con correo · ${conWhatsapp} con WhatsApp · faltan ~${faltan} min      `
  );

  if (quotaAgotada) {
    console.log(`\n${YELLOW}!${OFF} Se agotó el tope diario de consultas de búsqueda (${tope}).`);
    console.log(`${DIM}  El nivel 1 —el sitio propio del comercio— sigue funcionando sin tope, así`);
    console.log(`  que conviene dejarlo terminar igual: es de donde salen los correos.${OFF}`);
    quotaAgotada = false; // se sigue, sin nivel 3
  }
}
console.log("");

const { count: quedan } = await db
  .from("crm_contacts")
  .select("id", { count: "exact", head: true })
  .in("enrichment_status", ["pending", "running"]);

console.log(
  `\n${GREEN}✓${OFF} ${hechos} procesados en ${((Date.now() - t0) / 60000).toFixed(0)} min · ` +
    `${conEmail} correos nuevos · ${conWhatsapp} WhatsApp nuevos · quedan ${quedan ?? 0} en la cola`
);
console.log(
  `${YELLOW}Antes de mandarles nada${OFF}, pasá ${BOLD}node scripts/audit-level3.mjs${OFF} y revisá\n` +
    `  a mano los correos: el riesgo no es no encontrar, es inventar.`
);
