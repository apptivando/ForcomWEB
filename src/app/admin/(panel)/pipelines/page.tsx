import { listPipelineStages, listPipelineDeals, listCrmContacts } from "@/app/admin/actions";
import PipelineBoard from "@/components/admin/PipelineBoard";

export default async function PipelinesPage() {
  const [stages, deals, contacts] = await Promise.all([
    listPipelineStages(),
    listPipelineDeals(),
    listCrmContacts(),
  ]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-6 border-b border-[#2A2A2E]">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">
          Pipeline de ventas
        </h1>
        <p className="text-sm text-[#8A8A8A] mt-1">
          Seguimiento de oportunidades por contacto.
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-x-auto">
        <PipelineBoard initialStages={stages} initialDeals={deals} contacts={contacts} />
      </div>
    </div>
  );
}
