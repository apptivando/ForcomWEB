import { sectionTitle } from "@/lib/admin/sections";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole, hasMinRole } from "@/lib/auth/roles";
import WarrantiesTable from "@/components/admin/WarrantiesTable";
import MissingMigration from "@/components/admin/MissingMigration";
import type { Warranty } from "@/lib/types";

export const metadata = { title: sectionTitle("garantias") };

export default async function GarantiasPage() {
  const supabase = await createClient();
  const [{ data, error }, role] = await Promise.all([
    supabase.from("warranties").select("*").order("created_at", { ascending: false }),
    getCurrentRole(supabase),
  ]);
  const warranties = (data ?? []) as Warranty[];
  const pendientes = warranties.filter((w) => w.status === "pendiente").length;

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display font-extrabold text-3xl text-white">Garantías</h1>
          {pendientes > 0 && (
            <span className="px-2.5 py-1 bg-[#C41D16] text-white font-bold text-[13px] rounded-sm">{pendientes} para validar</span>
          )}
        </div>
        <p className="text-[#8A8A8A] mt-1 max-w-prose">
          12 meses desde la fecha de la factura, en todos los equipos. Las compras directas quedan activas solas; las compras en
          un comercio esperan a que alguien valide la factura con ese comercio.
        </p>
      </div>
      {error ? (
        <MissingMigration what="las garantías" />
      ) : (
        <WarrantiesTable warranties={warranties} canDelete={hasMinRole(role, "admin")} />
      )}
    </div>
  );
}
