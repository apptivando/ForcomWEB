"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseCatalogUrl } from "@/lib/catalog";

// Archivo propio y no dentro de actions.ts: ese archivo es muy distinto entre
// develop y main, y esto tiene que poder llegar a producción con un
// cherry-pick limpio.

/**
 * Guarda el link del catálogo de Publuu. Vacío lo saca del sitio. Devuelve el
 * link como quedó guardado, que puede no ser el pegado: se normaliza (ver
 * `parseCatalogUrl`), así el panel muestra lo que realmente se va a usar.
 */
export async function updateCatalogUrl(raw: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const trimmed = raw.trim();
  const catalog = trimmed ? parseCatalogUrl(trimmed) : null;
  if (trimmed && !catalog) {
    throw new Error(
      "Ese link no es de un catálogo de Publuu. Tiene que ser como https://publuu.com/flip-book/216706/1518341"
    );
  }

  const { error } = await supabase
    .from("company_info")
    .update({ catalog_url: catalog?.url ?? null, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) {
    // Sin la migración 021 la columna no existe y PostgREST lo dice en inglés.
    if (error.message.includes("catalog_url")) {
      throw new Error("Falta correr la migración 021 en Supabase (columna catalog_url).");
    }
    throw new Error(error.message);
  }

  // El ítem del menú aparece o desaparece en todas las páginas del sitio.
  revalidatePath("/", "layout");
  return catalog?.url ?? null;
}
