// Corre con: node scripts/fetch-products.mjs
// Muestra id, model, section y category de todos los productos en Supabase

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Leer .env.local manualmente
const envPath = resolve(__dirname, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim()))
);

const supabase = createClient(
  env["NEXT_PUBLIC_SUPABASE_URL"],
  env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
);

const { data, error } = await supabase
  .from("products")
  .select("id, model, section, category")
  .order("category")
  .order("order_index");

if (error) {
  console.error("Error:", error.message);
  process.exit(1);
}

console.log(`\n${"ID".padEnd(6)} ${"MODEL".padEnd(40)} ${"SECTION".padEnd(30)} CATEGORY`);
console.log("─".repeat(110));
for (const p of data) {
  console.log(
    `${String(p.id).padEnd(6)} ${(p.model ?? "").padEnd(40)} ${(p.section ?? "").padEnd(30)} ${p.category ?? ""}`
  );
}
console.log(`\nTotal: ${data.length} productos\n`);
