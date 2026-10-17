import { sectionTitle } from "@/lib/admin/sections";
import { createClient } from "@/lib/supabase/server";
import CatalogEditor from "@/components/admin/CatalogEditor";

export const metadata = { title: sectionTitle("catalogo") };

export default async function CatalogoPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("company_info").select("*").eq("id", 1).single();

  // `undefined` = la columna todavía no existe (falta la migración 021).
  const missingColumn = data != null && !("catalog_url" in data);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">Catálogo</h1>
        <p className="text-[15px] text-[#8A8A8A] mt-1 max-w-prose">
          El catálogo de Publuu que se muestra en{" "}
          <a href="/catalogo" target="_blank" className="text-[#FF6A5C] hover:text-white transition-colors">
            /catalogo
          </a>
          , con el menú del sitio arriba. Cuando salga un catálogo nuevo, reemplazá el link acá.
        </p>
      </div>
      {missingColumn && (
        <p className="max-w-3xl mb-6 text-[15px] text-[#FF6A5C] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3">
          Falta correr la migración 021 en Supabase. Hasta entonces el link no se puede guardar.
        </p>
      )}
      <CatalogEditor url={data?.catalog_url ?? null} />
    </div>
  );
}
