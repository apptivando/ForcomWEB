"use client";

import { useState, useTransition } from "react";
import { deleteWarranty, getInvoiceUrl, setWarrantyStatus, updateWarrantyNotes } from "@/app/admin/actions";
import type { Warranty } from "@/lib/types";
import { useToast } from "@/components/admin/Toast";

type Filter = "pendiente" | "activa" | "rechazada" | "todas";

const STATUS: Record<Warranty["status"], { label: string; cls: string }> = {
  pendiente: { label: "Pendiente", cls: "bg-[#C9A227]/10 text-[#E0BC45] border-[#C9A227]/30" },
  activa: { label: "Activa", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
  rechazada: { label: "Rechazada", cls: "bg-[#2A2A2E] text-[#8A8A8A] border-[#2A2A2E]" },
};

function dmy(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function todayAR() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

const btn = "px-4 py-2 text-xs font-display font-bold tracking-wider uppercase rounded-sm border transition-colors disabled:opacity-50";

export default function WarrantiesTable({ warranties, canDelete }: { warranties: Warranty[]; canDelete: boolean }) {
  const pendientes = warranties.filter((w) => w.status === "pendiente").length;
  const [filter, setFilter] = useState<Filter>(pendientes > 0 ? "pendiente" : "todas");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();
  const today = todayAR();

  const term = q.trim().toLowerCase();
  const visibles = warranties
    .filter((w) => filter === "todas" || w.status === filter)
    .filter(
      (w) =>
        !term ||
        [w.code, w.customer_name, w.email, w.customer_doc, w.invoice_number, w.product_name, w.store_name ?? ""].some((v) =>
          v.toLowerCase().includes(term)
        )
    );

  function decide(w: Warranty, status: Warranty["status"]) {
    setBusy(w.id);
    startTransition(async () => {
      try {
        await setWarrantyStatus(w.id, status, motivo[w.id]);
        setRejecting(null);
        toast.show(status === "activa" ? "Garantía activada" : "Garantía rechazada", {
          detail: ` ${w.code}. Le avisamos por correo a ${w.email}.`,
        });
      } catch (err) {
        toast.show(err instanceof Error ? err.message : "No se pudo guardar.", { kind: "error" });
      } finally {
        setBusy(null);
      }
    });
  }

  function openInvoice(w: Warranty) {
    // La ventana se abre ya, en el clic: si se abre después del await, el
    // navegador la toma como pop-up y la bloquea.
    const win = window.open("about:blank", "_blank");
    startTransition(async () => {
      try {
        const url = await getInvoiceUrl(w.id);
        if (url && win) win.location.href = url;
        else {
          win?.close();
          toast.show("Esta garantía no tiene factura adjunta.", { kind: "error" });
        }
      } catch {
        win?.close();
        toast.show("No se pudo abrir la factura.", { kind: "error" });
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 bg-[#141416] border border-[#2A2A2E] rounded-sm">
        {(["pendiente", "activa", "rechazada", "todas"] as const).map((f) => {
          const n = f === "todas" ? warranties.length : warranties.filter((w) => w.status === f).length;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[13px] font-semibold rounded-sm border transition-colors ${
                filter === f ? "bg-[#1A1A1E] text-white border-[#6A6A70]" : "text-[#8A8A8A] border-transparent hover:text-white"
              }`}
            >
              {f === "todas" ? "Todas" : f === "pendiente" ? "Para validar" : STATUS[f].label + "s"} ({n})
            </button>
          );
        })}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Código, nombre, email, DNI, factura…"
          aria-label="Buscar garantías"
          className="ml-auto flex-1 min-w-[200px] max-w-sm bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-3 py-2 text-[15px] text-white placeholder:text-[#6A6A70] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:outline-none"
        />
      </div>

      {visibles.length === 0 && (
        <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-12 text-center text-[#8A8A8A]">
          {warranties.length === 0 ? "Todavía no se registró ninguna garantía." : "Ninguna garantía coincide."}
        </div>
      )}

      {visibles.map((w) => {
        const open = expanded === w.id;
        const vencida = w.expires_on < today;
        return (
          <div key={w.id} className={`bg-[#141416] border rounded-sm ${w.status === "pendiente" ? "border-[#C9A227]/30" : "border-[#2A2A2E]"}`}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setExpanded(open ? null : w.id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[#1A1A1E]/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-[14px] text-[#FF6A5C]">{w.code}</span>
                  <span className="font-display font-bold text-white">{w.customer_name}</span>
                </div>
                <p className="text-[#8A8A8A] text-[13px] mt-0.5">
                  {w.product_name} × {w.quantity} · {w.purchase_channel === "comercio" ? `Comercio: ${w.store_name}` : "Compra directa"}
                </p>
              </div>
              {vencida && w.status === "activa" && (
                <span className="px-2 py-0.5 text-[12px] font-semibold rounded-sm border border-dashed border-[#4A4A52] text-[#8A8A8A] shrink-0">Vencida</span>
              )}
              <span className={`px-2.5 py-1 text-[12px] font-bold tracking-[0.1em] uppercase rounded-sm border shrink-0 ${STATUS[w.status].cls}`}>
                {STATUS[w.status].label}
              </span>
              <span className="text-[13px] text-[#8A8A8A] hidden sm:block shrink-0">{dmy(w.created_at)}</span>
            </button>

            {open && (
              <div className="px-5 pb-5 border-t border-[#2A2A2E] pt-4 space-y-5">
                <dl className="grid sm:grid-cols-3 gap-x-6 gap-y-3 text-[15px]">
                  {[
                    ["DNI / CUIT", w.customer_doc],
                    ["Email", w.email],
                    ["Teléfono", `+${w.phone}`],
                    ["Localidad", `${w.city}, ${w.province}`],
                    ["Factura", w.invoice_number],
                    ["Fecha de factura", dmy(w.invoice_date)],
                    ["Vence", dmy(w.expires_on) + (vencida ? " (vencida)" : "")],
                    ["Registrada", new Date(w.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })],
                    ["Revisada", w.reviewed_at ? new Date(w.reviewed_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-[12px] font-semibold tracking-[0.12em] uppercase text-[#8A8A8A]">{k}</dt>
                      <dd className="text-white break-words">{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="flex flex-wrap items-center gap-2">
                  {w.invoice_path ? (
                    <button type="button" onClick={() => openInvoice(w)} className={`${btn} bg-[#1A1A1E] border-[#6A6A70] text-[#B0B0B0] hover:text-white`}>
                      Ver factura
                    </button>
                  ) : (
                    <span className="text-[13px] text-[#8A8A8A]">Sin factura adjunta</span>
                  )}
                  <a
                    href={`mailto:${w.email}?subject=${encodeURIComponent(`Tu garantía FORCOM — ${w.code}`)}`}
                    className={`${btn} bg-[#1A1A1E] border-[#6A6A70] text-[#B0B0B0] hover:text-white`}
                  >
                    Escribir por email
                  </a>
                  <a
                    href={`https://wa.me/${w.phone}?text=${encodeURIComponent(`Hola ${w.customer_name}, te escribo de FORCOM por tu garantía ${w.code}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${btn} bg-[#1A1A1E] border-green-500/25 text-green-400 hover:border-green-500/50`}
                  >
                    WhatsApp
                  </a>
                </div>

                {w.status === "pendiente" && (
                  <div className="bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm p-4 space-y-3">
                    <p className="text-[15px] text-[#B0B0B0]">
                      Compró en <span className="text-white font-semibold">{w.store_name}</span>. Confirmá la factura con ese comercio y después:
                    </p>
                    {rejecting === w.id ? (
                      <div className="space-y-2">
                        <label htmlFor={`mot-${w.id}`} className="block text-[13px] text-[#8A8A8A]">
                          Motivo (le llega al cliente; opcional)
                        </label>
                        <input
                          id={`mot-${w.id}`}
                          value={motivo[w.id] ?? ""}
                          onChange={(e) => setMotivo((prev) => ({ ...prev, [w.id]: e.target.value }))}
                          placeholder="El comercio no encontró la factura."
                          className="w-full bg-[#141416] border border-[#6A6A70] rounded-sm px-3 py-2 text-white focus:ring-2 focus:ring-[#FF6A5C]/60 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button type="button" disabled={busy === w.id} onClick={() => decide(w, "rechazada")} className={`${btn} bg-[#C41D16] border-[#C41D16] text-white hover:bg-[#E8231A]`}>
                            Confirmar rechazo
                          </button>
                          <button type="button" onClick={() => setRejecting(null)} className="text-[13px] text-[#8A8A8A] hover:text-white px-2">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={busy === w.id} onClick={() => decide(w, "activa")} className={`${btn} bg-green-600 border-green-600 text-white hover:bg-green-700`}>
                          Validar y activar
                        </button>
                        <button type="button" onClick={() => setRejecting(w.id)} className={`${btn} border-[#6A6A70] text-[#B0B0B0] hover:text-white`}>
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {w.status !== "pendiente" && (
                  <button
                    type="button"
                    disabled={busy === w.id}
                    onClick={() => decide(w, w.status === "activa" ? "rechazada" : "activa")}
                    className="text-[13px] text-[#8A8A8A] hover:text-white font-semibold"
                  >
                    {w.status === "activa" ? "Pasar a rechazada" : "Activar igual"} (le avisa al cliente)
                  </button>
                )}

                <div>
                  <label htmlFor={`wn-${w.id}`} className="block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">
                    Notas internas
                  </label>
                  <textarea
                    id={`wn-${w.id}`}
                    rows={2}
                    value={notes[w.id] ?? w.admin_notes ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [w.id]: e.target.value }))}
                    placeholder="Reclamos, reparaciones, con quién se validó…"
                    className="w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-4 py-3 text-white placeholder:text-[#8A8A8A]/60 focus:ring-2 focus:ring-[#FF6A5C]/60 focus:outline-none resize-none text-[15px]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await updateWarrantyNotes(w.id, notes[w.id] ?? w.admin_notes ?? "");
                        toast.show("Notas guardadas");
                      })
                    }
                    className={`mt-2 ${btn} bg-[#1A1A1E] border-[#6A6A70] text-[#B0B0B0] hover:text-white`}
                  >
                    Guardar notas
                  </button>
                </div>

                {canDelete && (
                  <div className="pt-2 border-t border-[#2A2A2E]">
                    {confirmDelete === w.id ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[15px] text-[#FF6A5C]">¿Borrar la garantía y su factura? No se puede deshacer.</span>
                        <button
                          type="button"
                          onClick={() =>
                            startTransition(async () => {
                              await deleteWarranty(w.id);
                              setConfirmDelete(null);
                              toast.show("Garantía borrada", { detail: ` ${w.code}` });
                            })
                          }
                          className="px-4 py-1.5 text-[13px] font-bold bg-[#C41D16] text-white rounded-sm hover:bg-[#E8231A]"
                        >
                          Sí, borrar
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(null)} className="text-[15px] text-[#8A8A8A] hover:text-white">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(w.id)} className="text-[13px] text-[#8A8A8A] hover:text-[#FF6A5C] font-semibold">
                        Borrar garantía
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
