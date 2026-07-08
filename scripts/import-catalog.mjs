/**
 * Importa descripción y specs del catálogo markdown a Supabase.
 *
 * Dry-run (solo muestra lo que haría):
 *   node scripts/import-catalog.mjs
 *
 * Carga real:
 *   node scripts/import-catalog.mjs --update
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = !process.argv.includes("--update");

// ─── Supabase ────────────────────────────────────────────────────────────────

const envPath = resolve(__dirname, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const serviceKey = env["SUPABASE_SERVICE_KEY"];
if (!DRY_RUN && !serviceKey) {
  console.error("\n❌ Falta SUPABASE_SERVICE_KEY en .env.local");
  console.error("   Conseguila en Supabase → Settings → API → service_role key\n");
  process.exit(1);
}

const supabase = createClient(
  env["NEXT_PUBLIC_SUPABASE_URL"],
  serviceKey ?? env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
);

// ─── Mapeo heading del catálogo → ID en Supabase ─────────────────────────────

const PRODUCT_MAP = [
  { heading: "POS-PC TÁCTIL — A6 G2",                                                    id: "eb2ec4f7-9eed-4f0c-87f1-ee935a3ad82b" },
  { heading: "POS-PC TÁCTIL — T5",                                                        id: "aa681863-5af6-4890-b277-e9dfdc9f4aae" },
  { heading: "MINI PC — N100",                                                             id: "d18381e0-97cd-4ff1-b52b-7c15ac12356c" },
  { heading: "GAVETA MONEDERO DE 5 DIVISIONES — F5D",                                     id: "3809890b-6318-4e0a-93ac-49b00fd3e6f7" },
  { heading: "VISOR DE CORTESÍA — VEO",                                                   id: "edb9d324-c357-4175-8456-6418fd1ccb99" },
  { heading: "BALANZA COMERCIAL CON IMPRESOR DE ETIQUETAS — RLS1100",                     id: "9e3427c5-d0a8-439e-b436-a659ec9fc508" },
  { heading: "IMPRESOR TÉRMICO — TK-200",                                                 id: "16ce5582-a49a-426f-9532-946cf9027562" },
  { heading: "IMPRESOR TÉRMICO — TK-300",                                                 id: "8b4d5910-171f-447f-9c91-34efa4769bd6" },
  { heading: "IMPRESOR TÉRMICO DIRECTO Y TRANSFERENCIA DE CÓDIGOS DE BARRA — EASYLABEL", id: "1f65dbc2-7514-4742-a577-9a638dcdcec3" },
  { heading: "LECTOR DE CÓDIGOS DE BARRA DE MESA — F 898",                               id: "a893f06c-09da-4dc1-8cb8-c9e07015eec5" },
  { heading: "LECTOR DE CÓDIGOS DE BARRA DE MESA — F 888",                               id: "b6b4d1e9-e9d8-4912-9f1f-77d82e7c0e6c" },
  { heading: "LECTOR DE CÓDIGOS DE BARRA DE MESA — F 7088 (Multilectura)",               id: "da887ac0-1f50-4819-a43c-48dfa4a7be30" },
  { heading: "LECTOR DE CÓDIGOS DE BARRA DE MESA — F 9088 (Multilectura)",               id: "8592529b-06d2-4831-9c79-6d085f3c19a4" },
  { heading: "LECTOR DE CÓDIGOS DE BARRA INALÁMBRICO — F 8066",                          id: "1164ab17-133e-41a1-a0ea-c8434c83d9d1" },
  { heading: "LECTOR DE CÓDIGOS DE BARRA USB — F 2162",                                  id: "ac49172b-5ef6-4a4d-8354-f2dd1be4820f" },
  { heading: "LECTOR DE CÓDIGOS DE BARRA USB — F 2150",                                  id: "212794ee-5305-4602-86c9-8ced7ff7d88e" },
  { heading: "VERIFICADOR DE PRECIOS CON WINDOWS — X4w",                                 id: "f9761bff-bd54-4c18-886a-1fc1375dbd88" },
  { heading: "VERIFICADOR DE PRECIOS CON ANDROID — X4a",                                 id: "15613d81-b0af-4a5f-8e85-c8d89c93e3c7" },
];

// ─── Parser de secciones markdown ────────────────────────────────────────────

function parseCatalog(md) {
  // Partir en secciones por heading h3
  const sections = md.split(/\n(?=### )/);
  const results = [];

  for (const section of sections) {
    const lines = section.split("\n");
    const headingLine = lines[0];
    if (!headingLine.startsWith("### ")) continue;

    const heading = headingLine.replace(/^### /, "").trim();
    const body = lines.slice(1);

    const tableLines = [];
    const textLines = [];

    for (const line of body) {
      if (line.startsWith("|")) {
        tableLines.push(line);
      } else if (line.trim() !== "---") {
        textLines.push(line);
      }
    }

    const description = textLines.join("\n").trim() || null;
    const full_specs = tableLines.length > 0 ? tableLines.join("\n").trim() : null;

    results.push({ heading, description, full_specs });
  }

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const catalogPath = resolve(__dirname, "../../FORCOM_Catalogo_1Q_2026.md");
const md = readFileSync(catalogPath, "utf8");
const sections = parseCatalog(md);

console.log(`\n${DRY_RUN ? "🔍 DRY RUN — no se escribe nada (pasá --update para cargar)" : "🚀 CARGANDO en Supabase..."}\n`);
console.log("─".repeat(80));

let matched = 0;
let skipped = 0;
let errors = 0;

for (const { heading, id } of PRODUCT_MAP) {
  const section = sections.find((s) => s.heading === heading);

  if (!section) {
    console.log(`⚠  NO ENCONTRADO en catálogo: "${heading}"`);
    skipped++;
    continue;
  }

  const descPreview = (section.description ?? "").slice(0, 80).replace(/\n/g, " ");
  const specsLines = (section.full_specs ?? "").split("\n").length;

  console.log(`\n✓  ${heading}`);
  console.log(`   ID:          ${id}`);
  console.log(`   description: ${descPreview}…`);
  console.log(`   full_specs:  ${specsLines} líneas de tabla`);

  if (!DRY_RUN) {
    const { error } = await supabase
      .from("products")
      .update({
        description: section.description,
        full_specs: section.full_specs,
      })
      .eq("id", id);

    if (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      errors++;
    } else {
      console.log(`   ✅ Actualizado`);
      matched++;
    }
  } else {
    matched++;
  }
}

console.log("\n" + "─".repeat(80));
console.log(`\nResumen: ${matched} listos · ${skipped} no encontrados · ${errors} errores\n`);
if (DRY_RUN) {
  console.log("Para cargar: node scripts/import-catalog.mjs --update\n");
}
