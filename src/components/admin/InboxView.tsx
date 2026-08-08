"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { getConversationMessages, sendCrmReply } from "@/app/admin/actions";
import type { CrmConversation, CrmMessage } from "@/lib/types";

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export default function InboxView({
  initialConversations,
}: {
  initialConversations: CrmConversation[];
}) {
  const [conversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  );
  const [messages, setMessages] = useState<CrmMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoadingMessages(true);
      try {
        const data = await getConversationMessages(selectedId!);
        if (!cancelled) setMessages(data);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }
    load();
    // Poll cada 5s mientras el hilo esté abierto — versión simple sin
    // realtime de Supabase. Suficiente para uso de una sola persona a
    // la vez; si se vuelve un problema con varios agentes, pasar a
    // Supabase Realtime acá.
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !draft.trim()) return;
    setError("");
    setSending(true);
    const text = draft.trim();
    startTransition(async () => {
      try {
        await sendCrmReply(selectedId, text);
        setDraft("");
        const data = await getConversationMessages(selectedId);
        setMessages(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al enviar.");
      } finally {
        setSending(false);
      }
    });
  }

  return (
    <div className="h-full flex">
      {/* Lista de conversaciones */}
      <aside className="w-80 shrink-0 border-r border-[#2A2A2E] overflow-y-auto">
        {conversations.length === 0 && (
          <p className="text-sm text-[#8A8A8A] p-6">
            Todavía no hay conversaciones. Van a aparecer acá apenas llegue el primer mensaje.
          </p>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className={`w-full text-left px-5 py-4 border-b border-[#2A2A2E] transition-colors ${
              c.id === selectedId ? "bg-[#1A1A1E]" : "hover:bg-[#141416]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-display font-semibold text-white truncate">
                {c.contact?.name || c.contact?.phone || "Desconocido"}
              </p>
              <span className="text-[10px] text-[#8A8A8A] shrink-0">
                {formatTime(c.last_message_at)}
              </span>
            </div>
            <p className="text-xs text-[#8A8A8A] truncate mt-1">
              {c.last_message_text || "—"}
            </p>
          </button>
        ))}
      </aside>

      {/* Hilo */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[#8A8A8A]">
            Elegí una conversación
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-[#2A2A2E]">
              <p className="font-display font-semibold text-white">
                {selected.contact?.name || selected.contact?.phone}
              </p>
              <p className="text-xs text-[#8A8A8A]">{selected.contact?.phone}</p>
            </div>

            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
              {loadingMessages && messages.length === 0 && (
                <p className="text-sm text-[#8A8A8A]">Cargando...</p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-sm px-4 py-2.5 text-sm ${
                      m.direction === "out"
                        ? "bg-[#E8231A] text-white"
                        : "bg-[#1A1A1E] border border-[#2A2A2E] text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {m.content_text || `[${m.content_type}]`}
                    </p>
                    <p
                      className={`text-[10px] mt-1 ${
                        m.direction === "out" ? "text-white/70" : "text-[#8A8A8A]"
                      }`}
                    >
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSend} className="px-6 py-4 border-t border-[#2A2A2E]">
              {error && (
                <p className="text-sm text-[#E8231A] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-3 py-2 mb-3">
                  {error}
                </p>
              )}
              <div className="flex gap-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Escribí una respuesta..."
                  className="flex-1 bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-4 py-3 text-white placeholder:text-[#8A8A8A]/50 focus:border-[#E8231A] focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="px-6 py-3 bg-[#E8231A] text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-[#C41D16] transition-colors disabled:opacity-50"
                >
                  {sending ? "..." : "Enviar"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
