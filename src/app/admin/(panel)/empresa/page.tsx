import { sectionTitle } from "@/lib/admin/sections";
import { createClient } from "@/lib/supabase/server";
import CompanyInfoEditor from "@/components/admin/CompanyInfoEditor";
import ContactFormSwitch from "@/components/admin/ContactFormSwitch";
import type { CompanyInfo } from "@/lib/types";

export const metadata = { title: sectionTitle("empresa") };

const DEFAULT_INFO: CompanyInfo = {
  id: 1,
  whatsapp: "5491100000000",
  email: "ventas@forcom.tech",
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
  // Sin la migración 024 no existen las columnas nuevas: el interruptor avisa
  // y el editor no muestra (ni manda) Facebook e Instagram.
  const has024 = data != null && "own_contact_form" in data;

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">
          Información de la empresa
        </h1>
        <p className="text-[15px] text-[#8A8A8A] mt-1 max-w-prose">
          Datos de contacto que aparecen en la sección de contacto del sitio y en el botón de WhatsApp.
        </p>
      </div>
      <ContactFormSwitch initial={info.own_contact_form === true} available={has024} />
      <CompanyInfoEditor info={info} withSocial={has024} />
    </div>
  );
}
