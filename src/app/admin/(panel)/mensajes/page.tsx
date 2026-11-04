import Link from "next/link";
import { sectionTitle } from "@/lib/admin/sections";
import { createClient } from "@/lib/supabase/server";
import CRMInbox from "@/components/admin/CRMInbox";

export const metadata = { title: sectionTitle("mensajes") };

// En Next 16 `searchParams` es una Promise y hay que await-earla.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MensajesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // `?m=<id>` abre un mensaje puntual, ya expandido. Es lo que usan las filas
  // del dashboard: antes se veía el lead nuevo ahí y había que venir a esta
  // sección a buscarlo a mano.
  const raw = sp.m;
  const initialExpandedId = (Array.isArray(raw) ? raw[0] : raw)?.trim() || null;

  const supabase = await createClient();
  const [{ data: messages }, { data: company }] = await Promise.all([
    supabase.from("contact_messages").select("*").order("created_at", { ascending: false }),
    supabase.from("company_info").select("*").eq("id", 1).maybeSingle(),
  ]);
  // Con el formulario del CRM a la vista (lo normal), las consultas nuevas no
  // llegan acá: se avisa para que nadie espere mensajes que no van a entrar.
  const crmActive = company != null && "own_contact_form" in company && company.own_contact_form !== true;

  // El spam sale del contador: era justo lo que ensuciaba el número de nuevos.
  const newCount = messages?.filter((m) => m.status === "nuevo").length ?? 0;
  const realCount = messages?.filter((m) => m.status !== "spam").length ?? 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="font-display font-extrabold text-3xl text-white">
            Mensajes de contacto
          </h1>
          {newCount > 0 && (
            <span className="px-2.5 py-1 bg-[#C41D16] text-white font-bold text-[13px] rounded-sm">
              {newCount} nuevos
            </span>
          )}
        </div>
        <p className="text-[#8A8A8A] mt-1">{realCount} mensajes en total</p>
      </div>
      {crmActive && (
        <p className="max-w-3xl mb-6 text-[15px] text-[#B0B0B0] bg-[#141416] border border-[#2A2A2E] border-l-[3px] border-l-[#8A8A8A] rounded-sm px-4 py-3">
          La sección Contacto del sitio muestra el formulario del CRM: las consultas nuevas van al CRM y no entran acá. Si el
          CRM se cae, prendé el formulario propio en{" "}
          <Link href="/admin/empresa" className="text-[#FF6A5C] hover:underline">
            Info empresa
          </Link>
          .
        </p>
      )}
      <CRMInbox messages={messages ?? []} initialExpandedId={initialExpandedId} />
    </div>
  );
}
