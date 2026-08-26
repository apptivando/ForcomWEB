import { sectionTitle } from "@/lib/admin/sections";
import { listOutreachTemplates } from "@/app/admin/outreach-actions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/roles";
import { currentTransport } from "@/lib/outreach";
import TemplatesEditor from "@/components/admin/TemplatesEditor";

export const metadata = { title: sectionTitle("plantillas") };

export default async function PlantillasPage() {
  const supabase = await createClient();
  const [templates, role] = await Promise.all([
    listOutreachTemplates(),
    getCurrentRole(supabase),
  ]);
  const transport = currentTransport();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display font-extrabold text-3xl text-white">
          Plantillas de contacto inicial
        </h1>
        <p className="text-[#8A8A8A] mt-1 max-w-prose">
          Los mensajes con los que se le escribe por primera vez a un prospecto.
        </p>
      </div>

      {/* Esta explicación es la razón de ser de toda la pantalla: sin entenderla
          no se entiende por qué no alcanza con escribir un mensaje a mano. */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-5 mb-6 max-w-3xl text-[15px] text-[#B0B0B0] space-y-2">
        <p>
          <span className="text-white font-semibold">La ventana de 24 horas.</span> Con una conexión
          oficial de Meta, a un cliente se le puede escribir texto libre solo dentro de las 24 horas
          posteriores a <em>su</em> último mensaje. Fuera de esa ventana —o sea, en todo primer
          contacto— Meta únicamente acepta plantillas que haya aprobado antes.
        </p>
        <p>
          Por eso las plantillas se cargan acá con los datos que Meta pide (nombre, idioma,
          categoría y estado de aprobación): cuando se conecte la cuenta oficial no hay que rehacer
          nada.
        </p>
        <p className="text-[#8A8A8A]">
          Transporte actual:{" "}
          <span className="text-white">
            {transport === "meta" ? "Meta (oficial)" : "Evolution (no oficial)"}
          </span>
          {transport === "evolution" &&
            " — todavía no aplica la restricción de Meta, pero conviene trabajar como si aplicara."}
        </p>
      </div>

      <TemplatesEditor
        templates={templates}
        canEdit={role === "owner" || role === "admin"}
      />
    </div>
  );
}
