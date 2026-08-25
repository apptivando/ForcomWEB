// Audita lo que escribió el nivel 3 y, con --limpiar, borra lo que no pasa los
// controles de coherencia.
//
//   node scripts/audit-level3.mjs              # solo mira
//   node scripts/audit-level3.mjs --limpiar    # borra lo dudoso y re-encola
//
// POR QUÉ EXISTE
// La primera medición con Serper encendido dejó datos de otros comercios: un
// mail alemán para una ferretería de Paraná, el WhatsApp de San Juan para un
// comercio de Jujuy. El enriquecedor ya no los escribe (ver `hitEsDelProspecto`
// y `expectArea` en enrich.ts), pero lo que se guardó antes sigue ahí — y un
// correo equivocado no se descubre hasta que la campaña ya salió.
//
// Qué revisa:
//   · Teléfono y WhatsApp de otra área que la que dio Google.
//   · Correos de dominios que no son del comercio y aparecen en varias fichas
//     (el mail de la agencia web que le armó la ficha al directorio).
//   · Correos de dominios que no son argentinos ni genéricos conocidos.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(resolve(__dirname, "../.env.local"), "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const OFF = "\x1b[0m";

const limpiar = process.argv.includes("--limpiar");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

/** Sin acentos ni puntuación, igual que `normalizar` en enrich.ts. */
function normalizar(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const GENERICOS_NOMBRE = new Set([
  "ferreteria", "corralon", "pintureria", "buloneria", "distribuidora",
  "comercial", "mayorista", "deposito", "sucursal", "casa", "centro", "grupo",
  "srl", "sa", "sas", "hnos", "hermanos", "hijos", "los", "las", "del", "san",
  "santa", "don", "todo", "super", "mega",
]);

function tokensDe(name) {
  return normalizar(name)
    .split(" ")
    .filter((t) => t.length >= 4 && !GENERICOS_NOMBRE.has(t));
}

/** Espejo de `AR_AREA_PREFIXES` en src/lib/phone.ts. */
const AR_AREA_PREFIXES = new Set(["22", "23", "24", "26", "28", "29", "33", "34", "35", "36", "37", "38"]);

/** Mismo criterio que `areaDe` en enrich.ts: los 3 primeros del nacional. */
function areaDe(e164) {
  if (!e164) return null;
  const nacional = String(e164).replace(/^54(9)?/, "");
  if (nacional.length !== 10) return null;
  return nacional.startsWith("11") ? "11" : nacional.slice(0, 3);
}

// Todo lo que tocó el enriquecedor automático, no solo el nivel 3: la ficha de
// un directorio también llega por el nivel 1, cuando Google publica esa ficha
// como si fuera el sitio web del comercio.
const { data: filas, error } = await db
  .from("crm_contacts")
  .select("id, business_name, phone, email, whatsapp_phone, whatsapp_source, website, locality, enrichment_level")
  .gte("enrichment_level", 1)
  .limit(2000);
if (error) throw new Error(error.message);

const DIRECTORIOS = new Set([
  "guiaferreterias.com.ar", "paginasamarillas.com.ar", "cylex.com.ar",
  "guialocal.com.ar", "infoisinfo.com.ar", "opendi.com.ar", "tuugo.com.ar",
  "hotfrog.com.ar", "yalwa.com.ar", "dateas.com", "kompass.com",
  "guiaindustrial.com.ar", "elferretero.com.ar", "dir.ar", "empresite.com",
]);

console.log(`\n${BOLD}Fichas que tocó el enriquecedor:${OFF} ${filas.length}\n`);
if (filas.length === 0) process.exit(0);

// Un dominio que aparece en varias fichas distintas no es de ninguna: es el de
// la agencia que armó las fichas, o el del propio directorio.
const porDominio = new Map();
for (const f of filas) {
  if (!f.email) continue;
  const d = f.email.split("@")[1]?.toLowerCase();
  if (!d) continue;
  porDominio.set(d, (porDominio.get(d) ?? 0) + 1);
}
const GENERICOS_MAIL = /^(gmail|hotmail|yahoo|outlook|live|icloud|aol|yandex|proton(mail)?)\./i;

// Un mismo número en dos fichas DISTINTAS no es de ninguna de las dos: es el
// del directorio, o el de la agencia que publica las fichas. Pasó de verdad:
// dos ferreterías de Paraná quedaron con el mismo WhatsApp.
//
// Se cuentan fichas y no apariciones. Contando apariciones, el teléfono y el
// WhatsApp de un mismo comercio —que casi siempre son el mismo número— daban
// dos, y el control marcaba como sospechosos los casos correctos.
const fichasPorNumero = new Map();
for (const f of filas) {
  for (const n of [f.phone, f.whatsapp_phone]) {
    if (!n) continue;
    const nac = String(n).replace(/^54(9)?/, "");
    if (!fichasPorNumero.has(nac)) fichasPorNumero.set(nac, new Set());
    fichasPorNumero.get(nac).add(f.id);
  }
}

const sospechosos = [];
for (const f of filas) {
  // `motivos` borra, `dudas` solo avisa. La diferencia importa: borrar un
  // dato bueno cuesta una consulta de más; dejar uno malo cuesta una campaña
  // mandada a la empresa equivocada. Pero un control con falsos positivos
  // tampoco puede borrar, así que esos van a `dudas`.
  const motivos = [];
  const dudas = [];
  const area = areaDe(f.phone);

  // Áreas que no existen: el mismo control que ahora hace `isValidArNational`.
  for (const [campo, valor] of [["teléfono", f.phone], ["WhatsApp", f.whatsapp_phone]]) {
    const nac = String(valor ?? "").replace(/^54(9)?/, "");
    if (nac.length !== 10) continue;
    if (!nac.startsWith("11") && !AR_AREA_PREFIXES.has(nac.slice(0, 2))) {
      motivos.push(`área inexistente en el ${campo} (${nac.slice(0, 3)})`);
    }
  }

  if (f.whatsapp_phone && area && areaDe(f.whatsapp_phone) !== area) {
    motivos.push(`WhatsApp de área ${areaDe(f.whatsapp_phone)} y teléfono de ${area}`);
  }

  if (f.whatsapp_phone) {
    const nac = String(f.whatsapp_phone).replace(/^54(9)?/, "");
    const enCuantas = fichasPorNumero.get(nac)?.size ?? 0;
    if (enCuantas > 1) motivos.push(`WhatsApp repetido en ${enCuantas} comercios`);
  }

  // El "sitio web" que dio Google es en realidad una guía comercial: lo que se
  // sacó de ahí son los contactos de la guía.
  const host = (f.website ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const raizWeb = host.split(".").slice(-3).join(".");
  const esFichaDeGuia = [...DIRECTORIOS].some((d) => host === d || host.endsWith(`.${d}`) || raizWeb === d);
  if (esFichaDeGuia && (f.email || f.whatsapp_phone)) {
    motivos.push(`el "sitio web" es una guía comercial (${host})`);
  }

  if (f.email) {
    const d = f.email.split("@")[1]?.toLowerCase() ?? "";
    const generico = GENERICOS_MAIL.test(`${d}.`);

    if (!generico && porDominio.get(d) > 1) {
      motivos.push(`el dominio ${d} figura en ${porDominio.get(d)} fichas distintas`);
    }
    // Un comercio de barrio argentino no atiende por un dominio de otro país.
    // El `.cl` está en la lista por un caso real: una ferretería de Paraná
    // quedó con el mail de una cadena chilena que se llama parecido.
    if (/\.(cl|uy|py|bo|pe|br|mx|es|de|ru|cn|pl|nl|fr|it|us|co\.uk)$/i.test(d)) {
      motivos.push(`dominio extranjero (${d})`);
    }
    // Un dominio propio que no tiene NADA que ver con el nombre del comercio
    // suele ser de otro: la agencia que le armó la ficha al directorio, o el
    // directorio mismo. Los gratuitos quedan afuera de este control — nadie
    // espera que "ferreteriamiguel" aparezca en un gmail.
    // Un dominio propio que no se parece al nombre del comercio PUEDE ser de
    // otro. Pero también puede ser sus iniciales: `bdl@bld.com.ar` es de
    // "Bulonera del Litoral" y es correcto. Por eso esto solo AVISA — no borra
    // nada. Un control que se equivoca no puede tener la mano en el gatillo.
    if (!generico && d) {
      const nombre = normalizar(f.business_name ?? "").replace(/ /g, "");
      const dom = normalizar(d.split(".")[0] ?? "").replace(/ /g, "");
      const comparte =
        dom.length >= 4 &&
        (nombre.includes(dom.slice(0, Math.min(dom.length, 6))) ||
          tokensDe(f.business_name).some((t) => dom.includes(t)));
      if (!comparte) dudas.push(`el dominio ${d} no se parece al nombre del comercio`);
    }
  }

  if (motivos.length > 0 || dudas.length > 0) sospechosos.push({ fila: f, motivos, dudas });
}

if (sospechosos.length === 0) {
  console.log(`${GREEN}✓${OFF} Nada sospechoso.`);
  process.exit(0);
}

console.log(`${YELLOW}${sospechosos.length} fichas con datos dudosos${OFF}\n`);
console.table(
  sospechosos.map(({ fila, motivos, dudas }) => ({
    comercio: (fila.business_name ?? "").slice(0, 28),
    localidad: (fila.locality ?? "").slice(0, 16),
    tel: fila.phone ?? "—",
    email: fila.email ?? "—",
    whatsapp: fila.whatsapp_phone ?? "—",
    accion: motivos.length ? "se borra" : "revisar a mano",
    motivo: [...motivos, ...dudas].join(" · ").slice(0, 70),
  }))
);

if (!limpiar) {
  console.log(`${DIM}Para borrar estos datos y volver a buscarlos: --limpiar${OFF}`);
  process.exit(0);
}

let borrados = 0;
for (const { fila, motivos } of sospechosos) {
  if (motivos.length === 0) continue; // solo dudas: se muestran, no se tocan
  const patch = { enrichment_status: "pending", enrichment_error: null, scrape_attempts: 0 };
  if (motivos.some((m) => m.includes("WhatsApp"))) {
    patch.whatsapp_phone = null;
    patch.whatsapp_source = null;
  }
  if (motivos.some((m) => m.includes("dominio") || m.includes("guía comercial"))) patch.email = null;
  if (motivos.some((m) => m.includes("guía comercial"))) {
    patch.whatsapp_phone = null;
    patch.whatsapp_source = null;
  }
  // Un teléfono con área inexistente ya no lo escribiría el validador nuevo,
  // pero el que se guardó antes sigue ahí.
  if (motivos.some((m) => m.startsWith("área inexistente"))) patch.phone = null;

  const { error: e } = await db.from("crm_contacts").update(patch).eq("id", fila.id);
  if (e) {
    console.log(`${RED}✗${OFF} ${fila.business_name}: ${e.message}`);
    continue;
  }
  borrados++;
}

console.log(
  `\n${GREEN}✓${OFF} ${borrados} fichas limpiadas y devueltas a la cola. ` +
    `${DIM}El enriquecedor las vuelve a intentar, ahora con los controles puestos.${OFF}`
);
