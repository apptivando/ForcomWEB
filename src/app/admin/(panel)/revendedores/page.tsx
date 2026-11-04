import { sectionTitle } from "@/lib/admin/sections";
import { createClient } from "@/lib/supabase/server";
import ResellersInbox from "@/components/admin/ResellersInbox";
import MissingMigration from "@/components/admin/MissingMigration";
import type { ResellerRequest } from "@/lib/types";

export const metadata = { title: sectionTitle("revendedores") };

export default async function RevendedoresPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("reseller_requests").select("*").order("created_at", { ascending: false });
  const requests = (data ?? []) as ResellerRequest[];
  const nuevos = requests.filter((r) => r.status === "nuevo").length;

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display font-extrabold text-3xl text-white">Revendedores</h1>
          {nuevos > 0 && <span className="px-2.5 py-1 bg-[#C41D16] text-white font-bold text-[13px] rounded-sm">{nuevos} nuevos</span>}
        </div>
        <p className="text-[#8A8A8A] mt-1 max-w-prose">
          Pedidos de alta del formulario &ldquo;Sume FORCOM a su comercio&rdquo;. Cada uno espera la lista mayorista y los catálogos.
        </p>
      </div>
      {error ? <MissingMigration what="los revendedores" /> : <ResellersInbox requests={requests} />}
    </div>
  );
}
