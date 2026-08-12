import { getAiConfig, listKnowledgeDocuments } from "@/app/admin/actions";
import AgentEditor from "@/components/admin/AgentEditor";

export default async function AgentePage() {
  const [config, documents] = await Promise.all([
    getAiConfig(),
    listKnowledgeDocuments(),
  ]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">
          Asistente de IA
        </h1>
        <p className="text-sm text-[#8A8A8A] mt-1">
          Respuestas automáticas por WhatsApp, usando la base de conocimiento de abajo.
        </p>
      </div>
      <AgentEditor initialConfig={config} initialDocuments={documents} />
    </div>
  );
}
