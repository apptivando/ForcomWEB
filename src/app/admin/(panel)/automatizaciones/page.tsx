import { listAutomations, listMembersForAssignment } from "@/app/admin/actions";
import AutomationsEditor from "@/components/admin/AutomationsEditor";

export default async function AutomatizacionesPage() {
  const [automations, members] = await Promise.all([
    listAutomations(),
    listMembersForAssignment(),
  ]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">
          Automatizaciones
        </h1>
        <p className="text-sm text-[#8A8A8A] mt-1">
          Disparan cuando llega un mensaje (por palabra clave, o al abrirse una conversación nueva) y corren pasos en secuencia.
        </p>
      </div>
      <AutomationsEditor initialAutomations={automations} members={members} />
    </div>
  );
}
