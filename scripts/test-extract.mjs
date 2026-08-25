// Banco de pruebas del extractor de contactos.
//
//   node scripts/test-extract.mjs                      → corre los casos fijos
//   node scripts/test-extract.mjs https://sitio.com.ar → prueba contra un sitio real
//   node scripts/test-extract.mjs --file urls.txt      → una URL por línea
//
// Es el paso 6 del plan y el que más se itera: los casos fijos aseguran que
// nada se rompa, y el modo con URLs reales es el que dice si el extractor
// sirve de verdad en sitios argentinos. Corre sin API key y sin base de datos.
//
// Node ≥ 22.6 ejecuta los .ts directo. Si tu versión se queja, agregá
// --experimental-strip-types.

import { register } from "node:module";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { readFileSync } from "fs";

// Enseña a node a resolver los imports del proyecto (extensión implícita y el
// alias `@/`). Tiene que ir antes de cualquier import dinámico de un .ts.
register("./ts-resolve-hook.mjs", import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const lib = (f) => pathToFileURL(resolve(__dirname, "../src/lib", f)).href;

const {
  extractEmails, extractPhones, extractWhatsapp, extractSocials, extractInternalLinks,
  inlineJsonScripts,
} = await import(lib("prospects/extract.ts"));
const { classifyUrl, registrableDomain } = await import(lib("prospects/urls.ts"));
const { formatArPhone } = await import(lib("phone.ts"));

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const OFF = "\x1b[0m";

function analyze(raw, { siteDomain, baseUrl, fromContactPage } = {}) {
  // Lo mismo que hace `absorb()` en el enriquecedor, y por el mismo motivo: si
  // acá no se rescatara el JSON de los `<script>`, el banco de pruebas estaría
  // midiendo algo distinto de lo que corre en producción.
  const html = inlineJsonScripts(raw);

  const emails = extractEmails(html, { siteDomain, fromContactPage });
  const phones = extractPhones(html);
  const wa = extractWhatsapp(html);
  const socials = extractSocials(html);
  const links = baseUrl ? extractInternalLinks(html, baseUrl) : [];
  return {
    email: emails[0]?.email ?? null,
    allEmails: emails,
    phone: phones[0]?.e164 ?? null,
    allPhones: phones,
    whatsapp: wa?.phone ?? null,
    whatsappSource: wa?.source ?? null,
    unresolved: wa?.unresolvedLinks ?? [],
    ...socials,
    links,
  };
}

// ─── Casos fijos ─────────────────────────────────────────────────────────────

async function runFixtures() {
  const { CASES } = await import(pathToFileURL(resolve(__dirname, "fixtures/extract-cases.mjs")).href);
  let passed = 0;
  const failures = [];

  for (const c of CASES) {
    const got = analyze(c.html, { siteDomain: c.siteDomain, baseUrl: c.baseUrl });
    const problems = [];

    for (const [key, want] of Object.entries(c.expect)) {
      if (key === "emailNotNull") {
        if (!got.email?.includes("@")) problems.push(`email: esperaba algo, salió ${got.email}`);
        continue;
      }
      if (key === "links") {
        const gotUrls = got.links.map((l) => l.url);
        const missing = want.filter((w) => !gotUrls.includes(w));
        const extra = gotUrls.filter((g) => !want.includes(g));
        if (missing.length) problems.push(`links faltantes: ${missing.join(", ")}`);
        if (extra.length) problems.push(`links de más: ${extra.join(", ")}`);
        continue;
      }
      if (got[key] !== want) problems.push(`${key}: esperaba ${want}, salió ${got[key]}`);
    }

    if (problems.length === 0) {
      passed++;
      console.log(`${GREEN}✓${OFF} ${c.name}`);
    } else {
      failures.push({ name: c.name, problems });
      console.log(`${RED}✗${OFF} ${c.name}`);
      for (const p of problems) console.log(`   ${RED}${p}${OFF}`);
    }
  }

  console.log(
    `\n${passed}/${CASES.length} casos OK` + (failures.length ? ` — ${RED}${failures.length} fallan${OFF}` : "")
  );
  return failures.length === 0;
}

// ─── Sitios reales ───────────────────────────────────────────────────────────

async function runLive(urls) {
  const { fetchHtml, sleep } = await import(lib("prospects/http.ts"));
  const { isAllowed } = await import(lib("prospects/robots.ts"));

  const rows = [];
  for (const raw of urls) {
    const { url } = classifyUrl(raw);
    if (!url) {
      rows.push({ sitio: raw, estado: "url inválida" });
      continue;
    }

    const verdict = await isAllowed(url);
    if (!verdict.allowed) {
      rows.push({ sitio: registrableDomain(new URL(url).hostname), estado: `robots: ${verdict.reason}` });
      continue;
    }

    const res = await fetchHtml(url);
    if (!res.ok) {
      rows.push({
        sitio: registrableDomain(new URL(url).hostname),
        estado: `${res.reason}${res.detail ? ` (${res.detail})` : ""}`,
      });
      await sleep(verdict.delayMs);
      continue;
    }

    const host = new URL(res.ok.url).hostname;
    const got = analyze(res.ok.body, { siteDomain: registrableDomain(host), baseUrl: res.ok.url });
    rows.push({
      sitio: registrableDomain(host),
      estado: "ok",
      email: got.email ?? "—",
      tel: got.phone ? formatArPhone(got.phone) : "—",
      whatsapp: got.whatsapp ? `${got.whatsapp} (${got.whatsappSource})` : "—",
      ig: got.instagram ? "sí" : "—",
      fb: got.facebook ? "sí" : "—",
      "otras págs": got.links.length,
    });

    console.log(`${DIM}  ${host}: ${got.allEmails.length} mails, ${got.allPhones.length} tels${OFF}`);
    await sleep(verdict.delayMs);
  }

  console.table(rows);

  const ok = rows.filter((r) => r.estado === "ok");
  const conAlgo = ok.filter((r) => r.email !== "—" || r.whatsapp !== "—");
  console.log(
    `\n${ok.length}/${rows.length} sitios leídos · ` +
      `${conAlgo.length} con email o WhatsApp · ` +
      `${ok.filter((r) => r.whatsapp !== "—").length} con WhatsApp confirmado`
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let urls = args.filter((a) => !a.startsWith("--"));

const fileFlag = args.indexOf("--file");
if (fileFlag !== -1 && args[fileFlag + 1]) {
  urls = readFileSync(resolve(process.cwd(), args[fileFlag + 1]), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

if (urls.length > 0) {
  console.log(`Probando ${urls.length} sitio(s) reales…\n`);
  await runLive(urls);
} else {
  const ok = await runFixtures();
  console.log(
    `\n${DIM}Para probar contra sitios reales:\n` +
      `  node scripts/test-extract.mjs https://unaferreteria.com.ar\n` +
      `  node scripts/test-extract.mjs --file mis-urls.txt${OFF}`
  );
  process.exitCode = ok ? 0 : 1;
}
