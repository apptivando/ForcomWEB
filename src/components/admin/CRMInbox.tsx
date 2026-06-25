"use client";

import { useState, useTransition } from "react";
import { updateMessageStatus, updateMessageNotes, deleteMessage } from "@/app/admin/actions";
import type { ContactMessage } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  nuevo: "Nuevo",
  leido: "Leído",
  contactado: "Contactado",
};
const STATUS_COLOR: Record<string, string> = {
  nuevo: "bg-[#E8231A]/10 text-[#E8231A] border-[#E8231A]/20",
  leido: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  contactado: "bg-green-500/10 text-green-400 border-green-500/20",
};
const INDUSTRY_LABEL: Record<string, string> = {
  supermercado: "Supermercado",
  restaurante: "Restaurante",
  farmacia: "Farmacia",
  logistica: "Logística",
  estacion: "Est. Servicio",
  hoteleria: "Hotelería",
  otro: "Otro",
};

export default function CRMInbox({ messages }: { messages: ContactMessage[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  function handleStatusChange(id: string, status: ContactMessage["status"]) {
    startTransition(() => updateMessageStatus(id, status));
  }

  function handleSaveNotes(id: string) {
    startTransition(() => updateMessageNotes(id, notes[id] ?? ""));
  }

  function handleDelete(id: string) {
    startTransition(() => {
      deleteMessage(id);
      setConfirmDelete(null);
      if (expanded === id) setExpanded(null);
    });
  }

  if (messages.length === 0) {
    return (
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-12 text-center text-[#8A8A8A]">
        No hay mensajes todavía.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((msg) => {
        const isExpanded = expanded === msg.id;
        const noteVal = notes[msg.id] ?? msg.admin_notes ?? "";

        return (
          <div
            key={msg.id}
            className={`bg-[#141416] border rounded-sm transition-colors ${
              msg.status === "nuevo"
                ? "border-[#E8231A]/30"
                : "border-[#2A2A2E]"
            }`}
          >
            {/* Header row */}
            <div
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#1A1A1E]/50 transition-colors"
              onClick={() => toggleExpand(msg.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-display font-bold text-white">{msg.name}</span>
                  {msg.company && (
                    <span className="text-[#8A8A8A] text-sm">{msg.company}</span>
                  )}
                  {msg.industry && (
                    <span className="text-xs text-[#8A8A8A] bg-[#2A2A2E] px-2 py-0.5 rounded-sm">
                      {INDUSTRY_LABEL[msg.industry] ?? msg.industry}
                    </span>
                  )}
                </div>
                <p className="text-[#8A8A8A] text-xs mt-0.5">{msg.email}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`px-2.5 py-1 text-[10px] font-display font-bold tracking-[0.1em] uppercase rounded-sm border ${STATUS_COLOR[msg.status]}`}
                >
                  {STATUS_LABEL[msg.status]}
                </span>
                <span className="text-xs text-[#8A8A8A] hidden sm:block">
                  {new Date(msg.created_at).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <svg
                  className={`w-4 h-4 text-[#8A8A8A] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-5 pb-5 border-t border-[#2A2A2E] pt-4 space-y-5">
                {/* Message */}
                <div>
                  <p className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">
                    Mensaje
                  </p>
                  <p className="text-[#B0B0B0] leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                </div>

                {/* Status change */}
                <div>
                  <p className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">
                    Cambiar estado
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {(["nuevo", "leido", "contactado"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(msg.id, s)}
                        className={`px-3 py-1.5 text-xs font-display font-bold tracking-wider uppercase rounded-sm border transition-colors ${
                          msg.status === s
                            ? STATUS_COLOR[s] + " cursor-default"
                            : "border-[#2A2A2E] text-[#8A8A8A] hover:border-[#E8231A]/30 hover:text-white"
                        }`}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Admin notes */}
                <div>
                  <p className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">
                    Notas internas
                  </p>
                  <textarea
                    value={noteVal}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [msg.id]: e.target.value }))
                    }
                    rows={2}
                    placeholder="Notas para el equipo (no se muestran al cliente)..."
                    className="w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-4 py-3 text-white placeholder:text-[#8A8A8A]/50 focus:border-[#E8231A] focus:outline-none transition-colors resize-none text-sm"
                  />
                  <button
                    onClick={() => handleSaveNotes(msg.id)}
                    className="mt-2 px-4 py-1.5 text-xs font-display font-bold tracking-wider uppercase bg-[#1A1A1E] border border-[#2A2A2E] text-[#B0B0B0] hover:text-white hover:border-[#E8231A]/30 rounded-sm transition-colors"
                  >
                    Guardar notas
                  </button>
                </div>

                {/* Delete */}
                <div className="pt-2 border-t border-[#2A2A2E]">
                  {confirmDelete === msg.id ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-[#E8231A]">¿Eliminar este mensaje?</span>
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="px-4 py-1.5 text-xs font-display font-bold bg-[#E8231A] text-white rounded-sm hover:bg-[#C41D16] transition-colors"
                      >
                        Sí, eliminar
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-sm text-[#8A8A8A] hover:text-white transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(msg.id)}
                      className="text-xs text-[#8A8A8A] hover:text-[#E8231A] font-display font-semibold transition-colors"
                    >
                      Eliminar mensaje
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
