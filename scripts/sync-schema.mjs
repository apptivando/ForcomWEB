// Reconstruye la parte de `supabase/schema.sql` que espeja las migraciones de
// `supabase/sql-changes/`.
//
//   node scripts/sync-schema.mjs
//
// POR QUÉ EXISTE
// `schema.sql` es la referencia acumulada: sirve para levantar la base desde
// cero. Cada migración nueva se copia al final. Copiar a mano se olvida, y
// copiar con un script hecho para UNA migración es peor: la primera versión de
// esto truncaba desde su propio marcador hacia abajo, así que correrlo después
// de agregar migraciones nuevas se llevaba puestas las que venían después.
// Pasó, y por eso ahora el script rehace TODOS los bloques de una vez, en
// orden, desde los archivos de origen.
//
// CONVENCIÓN QUE ASUME
// Cada archivo de migración tiene su cabecera, después secciones numeradas
// `-- 1. …`, `-- 2. …`, y termina con `-- N. Verificación`. Se espeja lo que
// hay entre la sección 1 y la de verificación: la cabecera es específica del
// archivo y las consultas de verificación son de un solo uso.

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = resolve(root, "supabase/schema.sql");
const CHANGES = resolve(root, "supabase/sql-changes");

/**
 * Qué migraciones se espejan y con qué título.
 *
 * Solo las que agregaron algo al esquema después de que `schema.sql` dejara de
 * mantenerse a mano. Las anteriores ya están escritas ahí arriba y no se tocan.
 */
const MIRRORED = [
  ["010_clientes_unificados.sql", "clientes unificados + prospección (19/08/2026)"],
  ["011_contacto_en_frio.sql", "contacto en frío (20/08/2026)"],
  ["012_ficha_cliente.sql", "ficha de cliente y línea de tiempo (20/08/2026)"],
  ["013_lineas_whatsapp.sql", "líneas de WhatsApp (20/08/2026)"],
  ["014_analisis_conversaciones.sql", "análisis de conversaciones de vendedores (20/08/2026)"],
  ["015_invitaciones_propias.sql", "invitaciones con token propio (22/08/2026)"],
  ["016_recuperar_contrasena.sql", "recuperación de contraseña (24/08/2026)"],
];

/** El cuerpo de una migración: de la sección 1 hasta antes de la verificación. */
function bodyOf(file) {
  const lines = readFileSync(resolve(CHANGES, file), "utf8").split("\n");
  const start = lines.findIndex((l) => /^-- 1\. /.test(l));
  const end = lines.findIndex((l) => /^-- \d+\. Verificación/.test(l));
  if (start < 1) throw new Error(`${file}: no se encontró la sección "-- 1. "`);
  if (end < 0) throw new Error(`${file}: no se encontró la sección de verificación`);
  // start - 1 para incluir la línea de separación de arriba.
  return lines.slice(start - 1, end - 1).join("\n").replace(/\s+$/, "");
}

// Se corta el schema en el primer marcador espejado y se reconstruye de ahí.
const firstMarker = `-- Migración: ${MIRRORED[0][1]}`;
let schema = readFileSync(SCHEMA, "utf8");
const at = schema.indexOf(firstMarker);
if (at !== -1) {
  const sep = schema.lastIndexOf("-- ============================================================", at);
  schema = schema.slice(0, sep);
}
schema = schema.replace(/\s+$/, "");

const bar = "-- ============================================================";
for (const [file, title] of MIRRORED) {
  const header = [bar, `-- Migración: ${title}`, "-- Ejecutar en Supabase Dashboard > SQL Editor", `-- Ver supabase/sql-changes/${file}`, bar, ""].join("\n");
  schema += `\n\n\n${header}\n${bodyOf(file)}`;
}

writeFileSync(SCHEMA, `${schema}\n`);

// Aviso si hay una migración en la carpeta que nadie está espejando: es
// exactamente el olvido que este script existe para evitar.
const known = new Set(MIRRORED.map(([f]) => f));
const huerfanas = readdirSync(CHANGES)
  .filter((f) => /^\d{3}_.*\.sql$/.test(f) && Number(f.slice(0, 3)) >= 10 && !known.has(f));

console.log(`schema.sql reconstruido con ${MIRRORED.length} migraciones.`);
if (huerfanas.length) {
  console.log(`\n⚠ sin espejar: ${huerfanas.join(", ")} — agregalas a MIRRORED en este script.`);
}
