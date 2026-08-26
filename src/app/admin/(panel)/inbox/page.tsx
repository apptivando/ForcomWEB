import { sectionTitle } from "@/lib/admin/sections";
import { listConversations, listQuickReplies } from "@/app/admin/actions";
import InboxView from "@/components/admin/InboxView";

export const metadata = { title: sectionTitle("inbox") };

// En Next 16 `searchParams` es una Promise y hay que await-earla.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function InboxPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // `?c=<id>` abre una conversación puntual. Es lo que usa el botón "Escribir"
  // de Clientes para aterrizar en el hilo correcto en vez de en el primero de
  // la lista.
  const raw = sp.c;
  const selectedId = (Array.isArray(raw) ? raw[0] : raw)?.trim() || null;

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
        <p className="text-[15px] text-[#8A8A8A] mt-1 max-w-prose">
          Conversaciones con clientes, vía Evolution API.
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <InboxView
          initialConversations={conversations}
          initialQuickReplies={quickReplies}
          initialSelectedId={selectedId}
        />
      </div>
    </div>
  );
}
