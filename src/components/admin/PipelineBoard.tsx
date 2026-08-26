"use client";

import { useState, useTransition } from "react";
import {
  createPipelineDeal,
  moveDealStage,
  updatePipelineDeal,
  deletePipelineDeal,
} from "@/app/admin/actions";
import { clientLabel } from "@/lib/types";
import type { PipelineStage, PipelineDeal, CrmContact } from "@/lib/types";

const inputCls =
  "w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-3 py-2 text-[15px] text-white placeholder:text-[#8A8A8A]/50 focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none transition-colors";

function formatValue(v: number | null): string | null {
  if (v == null) return null;
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(v);
}

export default function PipelineBoard({
  initialStages,
  initialDeals,
  contacts,
}: {
  initialStages: PipelineStage[];
  initialDeals: PipelineDeal[];
  contacts: CrmContact[];
}) {
  const [, startTransition] = useTransition();
  const [deals, setDeals] = useState(initialDeals);
  const [addingToStage, setAddingToStage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function handleMove(dealId: string, stageId: string) {
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: stageId } : d)));
    startTransition(async () => {
      try {
        await moveDealStage(dealId, stageId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al mover.");
      }
    });
  }

  function handleDelete(dealId: string) {
    if (!confirm("¿Borrar esta oportunidad?")) return;
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
    startTransition(async () => {
      try {
        await deletePipelineDeal(dealId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al borrar.");
      }
    });
  }

  return (
    <div className="h-full flex items-start gap-4 p-6 min-w-max">
      {error && (
        <div className="fixed top-20 right-6 bg-[#E8231A]/10 border border-[#E8231A]/20 text-[#FF6A5C] text-[15px] px-4 py-3 rounded-sm z-10">
          {error}
        </div>
      )}
      {initialStages.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage_id === stage.id);
        return (
          // La columna es una superficie, no un título flotando sobre el vacío:
          // sin fondo ni borde no se leía como una zona a la que algo pertenece.
          // Y va `items-start` en el contenedor para que la altura la marque el
          // contenido — antes la columna medía toda la pantalla y "+ Nueva
          // oportunidad" quedaba a unos 600 px de su propio encabezado.
          <div
            key={stage.id}
            className="w-72 shrink-0 flex flex-col bg-[#141416] border border-[#2A2A2E] rounded-sm p-3 max-h-full"
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="font-display font-semibold text-[15px] text-white">{stage.name}</h3>
              <span className="text-[12px] text-[#8A8A8A] bg-[#1A1A1E] px-2 py-0.5 rounded-sm tabular-nums">
                {stageDeals.length}
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto min-h-[72px]">
              {stageDeals.length === 0 && (
                <div className="h-[72px] flex items-center justify-center border border-dashed border-[#2A2A2E] rounded-sm px-3 text-center">
                  <p className="text-[13px] text-[#6E6E76] leading-snug">
                    {stage.order_index === 0
                      ? "Las oportunidades entran acá desde un mensaje del formulario."
                      : "Movés una oportunidad con el desplegable de su tarjeta."}
                  </p>
                </div>
              )}
              {stageDeals.map((deal) =>
                editingId === deal.id ? (
                  <DealEditForm
                    key={deal.id}
                    deal={deal}
                    onDone={(updated) => {
                      setDeals((prev) => prev.map((d) => (d.id === deal.id ? { ...d, ...updated } : d)));
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                    setError={setError}
                  />
                ) : (
                  <div key={deal.id} className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-3">
                    <p className="text-[15px] font-display font-semibold text-white truncate">
                      {deal.contact ? clientLabel(deal.contact) : "—"}
                    </p>
                    <p className="text-[13px] text-[#8A8A8A] truncate">{deal.title}</p>
                    {deal.value != null && (
                      <p className="text-[13px] text-[#FF6A5C] font-semibold mt-1">{formatValue(deal.value)}</p>
                    )}
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <select
                        value={deal.stage_id}
                        onChange={(e) => handleMove(deal.id, e.target.value)}
                        className="bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-2 py-1 text-[13px] text-white focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none"
                      >
                        {initialStages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2 text-[13px] shrink-0">
                        <button onClick={() => setEditingId(deal.id)} className="text-[#8A8A8A] hover:text-white">
                          Editar
                        </button>
                        <button onClick={() => handleDelete(deal.id)} className="text-[#8A8A8A] hover:text-[#FF6A5C]">
                          Borrar
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {addingToStage === stage.id ? (
              <NewDealForm
                stageId={stage.id}
                contacts={contacts}
                onDone={(deal) => {
                  setDeals((prev) => [deal, ...prev]);
                  setAddingToStage(null);
                }}
                onCancel={() => setAddingToStage(null)}
                setError={setError}
              />
            ) : (
              <button
                onClick={() => setAddingToStage(stage.id)}
                className="mt-2 text-[13px] text-[#8A8A8A] hover:text-[#FF6A5C] text-left px-1"
              >
                + Nueva oportunidad
              </button>
            )}
          </div>
        );
      })}
      {/* El padding derecho del contenedor no se respeta cuando el contenido
          desborda: la última columna quedaba pegada al borde. Este espaciador
          sí ocupa lugar en el flujo horizontal. */}
      <div className="w-2 shrink-0" aria-hidden="true" />
    </div>
  );
}

function NewDealForm({
  stageId,
  contacts,
  onDone,
  onCancel,
  setError,
}: {
  stageId: string;
  contacts: CrmContact[];
  onDone: (deal: PipelineDeal) => void;
  onCancel: () => void;
  setError: (e: string) => void;
}) {
  const [, startTransition] = useTransition();
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId || !title.trim()) return;
    setSaving(true);
    startTransition(async () => {
      try {
        await createPipelineDeal({
          contactId,
          stageId,
          title,
          value: value ? Number(value) : null,
        });
        const contact = contacts.find((c) => c.id === contactId)!;
        onDone({
          id: crypto.randomUUID(),
          contact_id: contactId,
          stage_id: stageId,
          title: title.trim(),
          value: value ? Number(value) : null,
          notes: null,
          assigned_member_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          contact,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear.");
      } finally {
        setSaving(false);
      }
    });
  }

  if (contacts.length === 0) {
    return (
      <p className="text-[13px] text-[#8A8A8A] mt-2 px-1">
        Todavía no hay contactos (van a aparecer solos cuando entren mensajes por WhatsApp).
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-3 mt-2 space-y-2">
      <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputCls}>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {clientLabel(c)}
          </option>
        ))}
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (ej. Cotización TK-200)" className={inputCls} />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Valor estimado (opcional)"
        type="number"
        className={inputCls}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 bg-[#C41D16] text-white text-[13px] font-bold rounded-sm hover:bg-[#E8231A] disabled:opacity-50"
        >
          Guardar
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-[13px] text-[#8A8A8A] hover:text-white">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function DealEditForm({
  deal,
  onDone,
  onCancel,
  setError,
}: {
  deal: PipelineDeal;
  onDone: (updated: Partial<PipelineDeal>) => void;
  onCancel: () => void;
  setError: (e: string) => void;
}) {
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState(deal.title);
  const [value, setValue] = useState(deal.value != null ? String(deal.value) : "");
  const [notes, setNotes] = useState(deal.notes ?? "");
  const [saving, setSaving] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    startTransition(async () => {
      try {
        const parsedValue = value ? Number(value) : null;
        await updatePipelineDeal(deal.id, { title, value: parsedValue, notes: notes || null });
        onDone({ title: title.trim(), value: parsedValue, notes: notes.trim() || null });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar.");
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#141416] border border-[#E8231A]/40 rounded-sm p-3 space-y-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
      <input value={value} onChange={(e) => setValue(e.target.value)} type="number" placeholder="Valor" className={inputCls} />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" rows={2} className={`${inputCls} resize-none`} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 bg-[#C41D16] text-white text-[13px] font-bold rounded-sm hover:bg-[#E8231A] disabled:opacity-50"
        >
          Guardar
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-[13px] text-[#8A8A8A] hover:text-white">
          Cancelar
        </button>
      </div>
    </form>
  );
}
