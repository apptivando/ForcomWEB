import { createClient } from "@/lib/supabase/server";
import CRMInbox from "@/components/admin/CRMInbox";

export default async function CRMPage() {
  const supabase = await createClient();
  const { data: messages } = await supabase
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false });

  const newCount = messages?.filter((m) => m.status === "nuevo").length ?? 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="font-display font-extrabold text-3xl text-white">Mensajes / CRM</h1>
          {newCount > 0 && (
            <span className="px-2.5 py-1 bg-[#E8231A] text-white font-display font-bold text-xs rounded-sm">
              {newCount} nuevos
            </span>
          )}
        </div>
        <p className="text-[#8A8A8A] mt-1">
          {messages?.length ?? 0} mensajes en total
        </p>
      </div>
      <CRMInbox messages={messages ?? []} />
    </div>
  );
}
