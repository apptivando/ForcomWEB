import { createClient } from "@/lib/supabase/server";
import CompanyInfoEditor from "@/components/admin/CompanyInfoEditor";
import type { CompanyInfo } from "@/lib/types";

const DEFAULT_INFO: CompanyInfo = {
  id: 1,
  whatsapp: "5491100000000",
  email: "ventas@forcom.com.ar",
  phone: "+54 11 xxxx-xxxx",
  schedule: "Lun — Vie, 9:00 a 18:00",
  updated_at: new Date().toISOString(),
};

export default async function EmpresaPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_info")
    .select("*")
    .eq("id", 1)
    .single();

  const info: CompanyInfo = data ?? DEFAULT_INFO;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">
          Información de la empresa
        </h1>
        <p className="text-sm text-[#8A8A8A] mt-1">
          Datos de contacto que aparecen en la sección de contacto del sitio y en el botón de WhatsApp.
        </p>
      </div>
      <CompanyInfoEditor info={info} />
    </div>
  );
}
