// Carga masiva de fotos de producto desde "FORCOM 800x600/<carpeta>" a Supabase Storage + tabla products.
// Uso: node scripts/bulk-upload-images.js           -> dry run (no escribe nada)
//      node scripts/bulk-upload-images.js --commit   -> ejecuta de verdad

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const COMMIT = process.argv.includes("--commit");
const FOLDER_FILTER = process.argv.slice(2).find((a) => !a.startsWith("--"));
const MAX_IMAGES = 5;
const SOURCE_DIR = path.join(__dirname, "..", "..", "FORCOM 800x600");

// carpeta -> model (tal cual está en la tabla products)
const FOLDER_TO_MODEL = {
  "2150bt": "FORCOM 2150BT USB",
  "2162": "FORCOM 2162",
  "7088": "FORCOM 7088",
  "8066": "FORCOM 8066",
  "888": "FORCOM 888",
  "898": "FORCOM 898",
  "9088": "FORCOM 9088",
  "EASYLABEL": "EasyLabel",
  "GAVETA": "FORCOM 5D Cash Drawer",
  "MINI PC": "N100 Mini PC",
  "MONITOR CORTESIA": "FORCOM VEO Customer Display",
  "POS A6": "A6 G2 Smart-POS",
  "POS A5": "A5 Smart-POS",
  "TK200": "TK-200",
  "TK300": "TK-300",
  "VERIFICADOR ANDROID": "FORCOM VX4 Android",
  "VERIFICADOR WIN": "FORCOM VX4 Windows",
  "balanza": "RLS1100",
  // "POS T5 doble" queda sin mapear: el producto "T5 Smart-POS" fue renombrado a
  // "A5 Smart-POS" y sus fotos reales están en "POS A5", no en esta carpeta.
};

function loadEnv() {
  const env = {};
  fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
    .split(/\r?\n/)
    .forEach((l) => {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2];
    });
  return env;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const { data: products, error } = await supabase
    .from("products")
    .select("id, model, images, image_url");
  if (error) throw error;

  const byModel = new Map(products.map((p) => [p.model, p]));
  const folders = fs
    .readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  console.log(`${COMMIT ? "MODO COMMIT (escribe en Supabase)" : "DRY RUN (no escribe nada)"}\n`);

  for (const folder of folders) {
    if (FOLDER_FILTER && folder !== FOLDER_FILTER) continue;
    const model = FOLDER_TO_MODEL[folder];
    if (!model) {
      console.log(`SKIP  "${folder}" — sin mapeo a producto`);
      continue;
    }
    const product = byModel.get(model);
    if (!product) {
      console.log(`WARN  "${folder}" -> modelo "${model}" no encontrado en la DB`);
      continue;
    }

    const folderPath = path.join(SOURCE_DIR, folder);
    const files = fs
      .readdirSync(folderPath)
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, MAX_IMAGES);

    console.log(`\n"${folder}" -> ${model} (${product.id})`);
    console.log(`  imágenes actuales en DB: ${(product.images || []).length}`);
    console.log(`  subiendo ${files.length} archivo(s):`);

    const newUrls = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = path.extname(file).slice(1).toLowerCase();
      // Sufijo numérico en vez del nombre original: varios archivos de origen difieren
      // solo en espacios/puntos finales y colisionarían al pasarlos por slugify().
      const storagePath = `products/${slugify(model)}-${String(i + 1).padStart(2, "0")}.${ext}`;
      console.log(`    - ${file}  ->  ${storagePath}`);

      if (COMMIT) {
        const buffer = fs.readFileSync(path.join(folderPath, file));
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(storagePath, buffer, {
            upsert: true,
            contentType: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
          });
        if (upErr) {
          console.log(`      ERROR subiendo: ${upErr.message}`);
          continue;
        }
        const { data: pub } = supabase.storage.from("product-images").getPublicUrl(storagePath);
        newUrls.push(pub.publicUrl);
      }
    }

    if (COMMIT) {
      const { error: updErr } = await supabase
        .from("products")
        .update({
          images: newUrls,
          image_url: newUrls[0] ?? product.image_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);
      if (updErr) console.log(`  ERROR actualizando producto: ${updErr.message}`);
      else console.log(`  OK actualizado (${newUrls.length} imágenes)`);
    }
  }

  console.log("\nListo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
