import Link from "next/link";
import { sectionTitle } from "@/lib/admin/sections";
import { createClient } from "@/lib/supabase/server";
import FactsEditor from "@/components/admin/FactsEditor";
import MissingMigration from "@/components/admin/MissingMigration";
import type { Fact } from "@/lib/types";

export const metadata = { title: sectionTitle("datos") };

export default async function DatosPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("facts").select("*").order("order_index");

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-3xl text-white">Franja de datos</h1>
        <p className="text-[15px] text-[#8A8A8A] mt-1 max-w-prose">
          Datos destacados que van debajo del carrusel: garantía, cobertura, años en el mercado. Mientras esté vacía no se
          muestra en el sitio; aparece apenas guardás el primer dato.{" "}
          <Link href="/" target="_blank" className="text-[#FF6A5C] hover:underline">
            Ver el sitio
          </Link>
        </p>
      </div>
      {error ? <MissingMigration what="la franja de datos" /> : <FactsEditor initial={(data ?? []) as Fact[]} />}
    </div>
  );
}
