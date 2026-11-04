"use client";

import { useState, useTransition } from "react";
import { deleteResellers, updateResellerNotes, updateResellerStatus } from "@/app/admin/actions";
import type { ResellerRequest } from "@/lib/types";
import { useToast } from "@/components/admin/Toast";

const STATUS: Record<ResellerRequest["status"], { label: string; cls: string }> = {
  nuevo: { label: "Nuevo", cls: "bg-[#E8231A]/10 text-[#FF6A5C] border-[#E8231A]/20" },
  contactado: { label: "Contactado", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  alta: { label: "Dado de alta", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
  descartado: { label: "Descartado", cls: "bg-[#2A2A2E] text-[#8A8A8A] border-[#2A2A2E]" },
  spam: { label: "Spam", cls: "bg-[#2A2A2E] text-[#8A8A8A] border-[#2A2A2E]" },
};
const ORDER: ResellerRequest["status"][] = ["nuevo", "contactado", "alta", "descartado", "spam"];
const RESTAURAR_MS = 7500;

function whatsapp(r: ResellerRequest) {
  const text = `Hola ${r.name}, te escribo de FORCOM por tu pedido para ser revendedor (${r.company}).`;
  return `https://wa.me/${r.phone}?text=${encodeURIComponent(text)}`;
}

export default function ResellersInbox({ requests }: { requests: ResellerRequest[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"abiertos" | "todos">("abiertos");
  const [borrandose, setBorrandose] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();

  const visibles = requests
    .filter((r) => !borrandose.has(r.id))
    .filter((r) => filter === "todos" || r.status === "nuevo" || r.status === "contactado");

  function handleDelete(r: ResellerRequest) {
    setConfirmDelete(null);
    setBorrandose((prev) => new Set(prev).add(r.id));
    toast.undoable("Pedido eliminado", () => startTransition(() => deleteResellers([r.id])), { detail: r.company });
    setTimeout(() => {
      setBorrandose((prev) => {
        const next = new Set(prev);
        next.delete(r.id);
        return next;
      });
    }, RESTAURAR_MS);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 bg-[#141416] border border-[#2A2A2E] rounded-sm">
        {(["abiertos", "todos"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-[13px] font-semibold rounded-sm border transition-colors ${
              filter === f ? "bg-[#1A1A1E] text-white border-[#6A6A70]" : "text-[#8A8A8A] border-transparent hover:text-white"
            }`}
          >
            {f === "abiertos" ? "Por atender" : `Todos (${requests.length})`}
          </button>
        ))}
      </div>

      {visibles.length === 0 && (
        <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-12 text-center text-[#8A8A8A]">
          {filter === "abiertos" ? "No hay pedidos por atender." : "No hay pedidos todavía."}
        </div>
      )}

      {visibles.map((r) => {
        const open = expanded === r.id;
        return (
          <div key={r.id} className={`bg-[#141416] border rounded-sm ${r.status === "nuevo" ? "border-[#E8231A]/30" : "border-[#2A2A2E]"}`}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setExpanded(open ? null : r.id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[#1A1A1E]/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-display font-bold text-white">{r.company}</span>
                  <span className="text-[13px] text-[#B0B0B0] bg-[#2A2A2E] px-2 py-0.5 rounded-sm">{r.province}</span>
                </div>
                <p className="text-[#8A8A8A] text-[13px] mt-0.5">
                  {r.name}
                  {r.business_type ? ` · ${r.business_type}` : ""}
                </p>
              </div>
              <span className={`px-2.5 py-1 text-[12px] font-bold tracking-[0.1em] uppercase rounded-sm border shrink-0 ${STATUS[r.status].cls}`}>
                {STATUS[r.status].label}
              </span>
              <span className="text-[13px] text-[#8A8A8A] hidden sm:block shrink-0">
                {new Date(r.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </button>

            {open && (
              <div className="px-5 pb-5 border-t border-[#2A2A2E] pt-4 space-y-5">
                {r.message && <p className="text-[#B0B0B0] leading-relaxed whitespace-pre-wrap">{r.message}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={whatsapp(r)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-xs font-display font-bold tracking-wider uppercase rounded-sm bg-[#1A1A1E] border border-green-500/25 text-green-400 hover:border-green-500/50 transition-colors"
                  >
                    Escribir por WhatsApp
                  </a>
                  <span className="text-[13px] text-[#8A8A8A]">+{r.phone}</span>
                </div>

                <div>
                  <p className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">Estado</p>
                  <div className="flex gap-2 flex-wrap">
                    {ORDER.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => startTransition(() => updateResellerStatus(r.id, s))}
                        className={`px-3 py-1.5 text-xs font-display font-bold tracking-wider uppercase rounded-sm border transition-colors ${
                          r.status === s ? STATUS[s].cls + " cursor-default" : "border-[#2A2A2E] text-[#8A8A8A] hover:text-white"
                        }`}
                      >
                        {STATUS[s].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor={`rn-${r.id}`} className="block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">
                    Notas internas
                  </label>
                  <textarea
                    id={`rn-${r.id}`}
                    rows={2}
                    value={notes[r.id] ?? r.admin_notes ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Lista enviada el…, condiciones acordadas…"
                    className="w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-4 py-3 text-white placeholder:text-[#8A8A8A]/60 focus:ring-2 focus:ring-[#FF6A5C]/60 focus:outline-none resize-none text-[15px]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await updateResellerNotes(r.id, notes[r.id] ?? r.admin_notes ?? "");
                        toast.show("Notas guardadas");
                      })
                    }
                    className="mt-2 px-4 py-1.5 text-xs font-display font-bold tracking-wider uppercase bg-[#1A1A1E] border border-[#6A6A70] text-[#B0B0B0] hover:text-white rounded-sm transition-colors"
                  >
                    Guardar notas
                  </button>
                </div>

                <div className="pt-2 border-t border-[#2A2A2E]">
                  {confirmDelete === r.id ? (
                    <div className="flex items-center gap-3">
                      <span className="text-[15px] text-[#FF6A5C]">¿Eliminar este pedido?</span>
                      <button type="button" onClick={() => handleDelete(r)} className="px-4 py-1.5 text-[13px] font-bold bg-[#C41D16] text-white rounded-sm hover:bg-[#E8231A]">
                        Sí, eliminar
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="text-[15px] text-[#8A8A8A] hover:text-white">
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(r.id)} className="text-[13px] text-[#8A8A8A] hover:text-[#FF6A5C] font-semibold">
                      Eliminar pedido
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
