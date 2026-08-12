import { listConversations, listQuickReplies } from "@/app/admin/actions";
import InboxView from "@/components/admin/InboxView";

export default async function InboxPage() {
  const [conversations, quickReplies] = await Promise.all([
    listConversations(),
    listQuickReplies(),
  ]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-6 border-b border-[#2A2A2E]">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">
          Bandeja de WhatsApp
        </h1>
        <p className="text-sm text-[#8A8A8A] mt-1">
          Conversaciones con clientes, vía Evolution API.
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <InboxView initialConversations={conversations} initialQuickReplies={quickReplies} />
      </div>
    </div>
  );
}
