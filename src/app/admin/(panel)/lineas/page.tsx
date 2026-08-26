import { sectionTitle } from "@/lib/admin/sections";
import { listWaLines } from "@/app/admin/line-actions";
import { listMembersForAssignment } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/roles";
import LinesManager from "@/components/admin/LinesManager";

export const metadata = { title: sectionTitle("lineas") };

export default async function LineasPage() {
  const supabase = await createClient();
  const [lines, members, role] = await Promise.all([
    listWaLines(),
    listMembersForAssignment(),
    getCurrentRole(supabase),
  ]);

  if (role !== "owner" && role !== "admin") {
    return (
      <div className="p-8">
        <h1 className="font-display font-extrabold text-3xl text-white">Líneas de WhatsApp</h1>
        <p className="text-[#8A8A8A] mt-2 max-w-prose">
          Solo un owner o un admin puede administrar las líneas.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display font-extrabold text-3xl text-white">Líneas de WhatsApp</h1>
        <p className="text-[#8A8A8A] mt-1 max-w-prose">
          Los números conectados al sistema: el oficial de la empresa y los de los vendedores.
        </p>
      </div>

      {/* Esta explicación es la razón de ser de la pantalla: sin entenderla,
          "conectar una línea" parece una configuración más. */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-5 mb-6 max-w-3xl text-[15px] text-[#B0B0B0] space-y-2">
        <p>
          <span className="text-white font-semibold">Son dos cosas distintas.</span> La línea
          oficial es la que se atiende desde la Bandeja: ahí se lee y se responde. Las líneas de
          los vendedores <em>no se operan desde acá</em> — solo registran lo que se habla, para que
          quede en la ficha del cliente y se pueda analizar después.
        </p>
        <p>
          Conectar la línea de un vendedor es vincular un dispositivo a su WhatsApp, igual que
          WhatsApp Web. Cada número admite 4 dispositivos vinculados además del teléfono, así que
          esto ocupa uno y le quedan tres.
        </p>
        <p className="text-yellow-400">
          Queda registrado <strong>todo</strong> lo que pase por ese número, no solo lo de trabajo.
          Conviene que la persona lo sepa, y que sea un número de la empresa.
        </p>
      </div>

      <LinesManager
        lines={lines}
        members={members}
        managerUrl={process.env.EVOLUTION_API_URL ?? null}
      />
    </div>
  );
}
