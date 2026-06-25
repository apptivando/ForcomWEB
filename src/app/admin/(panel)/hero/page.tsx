import { createClient } from "@/lib/supabase/server";
import HeroSlidesManager from "@/components/admin/HeroSlidesManager";

export default async function HeroPage() {
  const supabase = await createClient();
  const { data: slides } = await supabase
    .from("hero_slides")
    .select("*")
    .order("order_index");

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-3xl text-white">Carrusel Hero</h1>
        <p className="text-[#8A8A8A] mt-1 text-sm">
          Gestioná los slides del carrusel principal · El sitio muestra los slides activos en el orden definido aquí
        </p>
      </div>
      <HeroSlidesManager initial={slides ?? []} />
    </div>
  );
}
