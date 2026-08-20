// Hook de resolución de módulos para correr los .ts del proyecto con node
// directo, sin pasar por el bundler de Next.
//
// Node ejecuta TypeScript desde la 22.6 (borra los tipos), pero resuelve los
// imports con las reglas de ESM: exige la extensión y no conoce el alias `@/`
// del tsconfig. Este hook cubre las dos cosas, así el código fuente puede
// escribirse con el estilo normal del proyecto y `scripts/test-extract.mjs`
// igual lo puede importar.
//
// Solo lo usan los scripts de `scripts/`. La app nunca pasa por acá.

import { statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = resolvePath(dirname(fileURLToPath(import.meta.url)), "../src");

function firstFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}/index.ts`]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // sigue probando
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let base = null;

  if (specifier.startsWith("@/")) {
    base = resolvePath(SRC, specifier.slice(2));
  } else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
  }

  if (base) {
    const found = firstFile(base);
    // Sin `format`: node lo deduce de la extensión y así aplica el borrado de
    // tipos a los .ts. Forzar "module" haría que intente parsearlos como JS.
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
