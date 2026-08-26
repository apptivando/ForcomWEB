"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { getConversationMessages } from "@/app/admin/actions";
import ThreadComposer from "@/components/admin/ThreadComposer";
import { clientLabel } from "@/lib/types";
import type { CrmConversation, CrmMessage, QuickReply } from "@/lib/types";

/**
 * Hora del mensaje dentro del hilo.
 *
 * Antes solo se mostraba la fecha ("12/8"), sin hora: en una conversación de
 * WhatsApp la hora es el dato que ubica, y la fecha ya la dice el separador de
 * día. Hoy va la hora siempre; el día lo pone `dayLabel`.
 */
function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}


/**
 * Marca de tiempo de la LISTA de conversaciones. Acá sí conviene la fecha para
 * lo viejo: es lo que ordena y ubica de un vistazo. La hora sola sería peor.
 */
function formatListTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}
/** Etiqueta del separador de día: "Hoy", "Ayer" o la fecha completa. */
function dayLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Clave de día para saber dónde cortar. */
function dayKey(iso: string | null): string {
  return iso ? new Date(iso).toDateString() : "";
}

export default function InboxView({
  initialConversations,
  initialQuickReplies,
  initialSelectedId,
}: {
  initialConversations: CrmConversation[];
  initialQuickReplies: QuickReply[];
  /**
   * Conversación a abrir, de `?c=<id>` en la URL. Es lo que permite que
   * "Escribir" desde Clientes aterrice en el hilo correcto en vez de en el
   * primero de la lista.
   */
  initialSelectedId?: string | null;
}) {
  // Directo de las props y no en useState: así `router.refresh()` después de
  // enviar actualiza el preview y la hora de la lista lateral. Guardado en
  // estado quedaba congelado con lo que hubiera al montar.
  const conversations = initialConversations;
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    // Si el id de la URL no está en la lista (una conversación recién creada
    // que este render todavía no vio), se cae al primero en vez de dejar la
    // pantalla vacía.
    if (initialSelectedId && initialConversations.some((c) => c.id === initialSelectedId)) {
      return initialSelectedId;
    }
    return initialConversations[0]?.id ?? null;
  });
  const [messages, setMessages] = useState<CrmMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  // Buscador de la lista. Con dos conversaciones no hace falta; con cincuenta
  // sí, y no había forma de encontrar una.
  const [filtro, setFiltro] = useState("");
  const conversacionesFiltradas = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    if (!t) return conversations;
    return conversations.filter((c) =>
      [c.contact ? clientLabel(c.contact) : "", c.contact?.phone, c.contact?.business_name, c.last_message_text]
        .filter(Boolean)
        .some((campo) => campo!.toLowerCase().includes(t))
    );
  }, [conversations, filtro]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [quickReplies, setQuickReplies] = useState(initialQuickReplies);
  const router = useRouter();

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

  async function refreshMessages() {
    if (!selectedId) return;
    setMessages(await getConversationMessages(selectedId));
    // Y la lista lateral, para que el preview y la hora reflejen lo recién
    // enviado sin tener que recargar la página.
    router.refresh();
  }

  return (
    <div className="h-full flex">
      {/* Lista de conversaciones */}
      <aside className="w-80 shrink-0 border-r border-[#2A2A2E] flex flex-col">
        <div className="p-3 border-b border-[#2A2A2E] shrink-0">
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar conversación…"
            aria-label="Buscar conversación por nombre, empresa o teléfono"
            className="w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-3 py-2 text-[15px] text-white placeholder:text-[#6E6E76] focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="text-[15px] text-[#8A8A8A] p-6">
            Todavía no hay conversaciones. Van a aparecer acá apenas llegue el primer mensaje.
          </p>
        )}
        {conversations.length > 0 && conversacionesFiltradas.length === 0 && (
          <p className="text-[15px] text-[#8A8A8A] p-6">
            Ninguna conversación coincide con “{filtro}”.
          </p>
        )}
        {conversacionesFiltradas.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className={`w-full text-left px-5 py-4 border-b border-[#2A2A2E] transition-colors ${
              c.id === selectedId ? "bg-[#1A1A1E]" : "hover:bg-[#141416]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[15px] font-display font-semibold text-white truncate">
                {c.contact ? clientLabel(c.contact) : "Desconocido"}
              </p>
              <span className="text-[12px] text-[#8A8A8A] shrink-0">
                {formatListTime(c.last_message_at)}
              </span>
            </div>
            <p className="text-[13px] text-[#8A8A8A] truncate mt-1">
              {c.last_message_text || "—"}
            </p>
          </button>
        ))}
        </div>
      </aside>

      {/* Hilo */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-[15px] text-[#8A8A8A]">
            Elegí una conversación
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-[#2A2A2E]">
              <p className="font-display font-semibold text-white">
                {selected.contact ? clientLabel(selected.contact) : "Desconocido"}
              </p>
              <p className="text-[13px] text-[#8A8A8A]">{selected.contact?.phone}</p>
            </div>

            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
              {loadingMessages && messages.length === 0 && (
                <p className="text-[15px] text-[#8A8A8A]">Cargando...</p>
              )}
              {messages.map((m, i) => {
                // Separador de día: sin él, un hilo largo es una pared de
                // mensajes sin referencia temporal.
                const nuevoDia = i === 0 || dayKey(m.created_at) !== dayKey(messages[i - 1].created_at);
                return (
                  <div key={m.id}>
                    {nuevoDia && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-[#2A2A2E]" />
                        <span className="text-[12px] font-semibold tracking-wider uppercase text-[#6E6E76]">
                          {dayLabel(m.created_at)}
                        </span>
                        <div className="flex-1 h-px bg-[#2A2A2E]" />
                      </div>
                    )}
                    <div className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                      {/* El mensaje propio va en VERDE, no en rojo. En WhatsApp
                          —la app que el operador usa todo el día— el mensaje
                          propio es verde, y el rojo se lee como error o como
                          mensaje no entregado. */}
                      <div
                        className={`max-w-[70%] rounded-sm px-4 py-2.5 text-[15px] ${
                          m.direction === "out"
                            ? "bg-green-800 text-white"
                            : "bg-[#1A1A1E] border border-[#2A2A2E] text-white"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {m.content_text || `[${m.content_type}]`}
                        </p>
                        <p
                          className={`text-[12px] mt-1 text-right ${
                            m.direction === "out" ? "text-white/70" : "text-[#8A8A8A]"
                          }`}
                        >
                          {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selected.contact && (
              <ThreadComposer
                contact={selected.contact}
                conversationId={selected.id}
                quickReplies={quickReplies}
                onQuickRepliesChange={setQuickReplies}
                onSent={refreshMessages}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
