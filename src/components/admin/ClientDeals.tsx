"use client";

import { useCallback, useEffect, useState } from "react";
import { listContactDeals } from "@/app/admin/client-actions";
import { createPipelineDeal, moveDealStage } from "@/app/admin/actions";
import type { PipelineDeal, PipelineStage } from "@/lib/types";

function formatValue(value: number | null): string {
  if (value == null) return "";
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

/**
 * Las oportunidades del cliente, dentro de la ficha.
 *
 * Reusa `createPipelineDeal` y `moveDealStage` tal cual — no hay lógica nueva,
 * solo el mismo Pipeline visto desde el otro lado. Mover una etapa desde acá
 * queda registrado en la línea de tiempo igual que si se hiciera desde el
 * kanban, porque el registro lo hace un trigger de la base y no la pantalla.
 */
export default function ClientDeals({
  contactId,
  stages,
}: {
  contactId: string;
  stages: PipelineStage[];
}) {
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDeals(await listContactDeals(contactId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    setDeals([]);
    setAdding(false);
    setTitle("");
    setValue("");
    load();
  }, [contactId, load]);

  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? "—";

  async function handleCreate() {
    if (!title.trim() || !stages[0]) return;
    try {
      await createPipelineDeal({
        contactId,
        stageId: stages[0].id,
        title: title.trim(),
        value: value.trim() ? Number(value) : null,
      });
      setTitle("");
      setValue("");
      setAdding(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la oportunidad");
    }
  }

  async function handleMove(dealId: string, stageId: string) {
    try {
      await moveDealStage(dealId, stageId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al mover la oportunidad");
    }
  }

  const field =
    "bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-2.5 py-1.5 text-[13px] text-white placeholder:text-[#8A8A8A] focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">
          Pipeline de ventas
        </p>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-[13px] text-[#8A8A8A] hover:text-white"
          >
            + Nueva oportunidad
          </button>
        )}
      </div>

      {error && <p className="text-[13px] text-[#FF6A5C] mb-2">{error}</p>}

      {loading && <p className="text-[13px] text-[#8A8A8A]">Cargando…</p>}

      {!loading && deals.length === 0 && !adding && (
        <p className="text-[13px] text-[#8A8A8A]">Sin oportunidades abiertas.</p>
      )}

      <div className="space-y-2">
        {deals.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-2 bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white truncate">{d.title}</p>
              {d.value != null && (
                <p className="text-[13px] text-[#FF6A5C]">{formatValue(d.value)}</p>
              )}
            </div>
            <select
              value={d.stage_id}
              onChange={(e) => handleMove(d.id, e.target.value)}
              className="bg-[#141416] border border-[#2A2A2E] rounded-sm px-2 py-1 text-[13px] text-white focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none"
              title={`Etapa actual: ${stageName(d.stage_id)}`}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-2 space-y-2 bg-[#0D0D0F] border border-[#6A6A70] rounded-sm p-3">
          <input
            className={`${field} w-full`}
            placeholder="Qué se le está vendiendo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className={`${field} w-full`}
            placeholder="Valor estimado (opcional)"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
          />
          <div className="flex gap-3 text-[13px]">
            <button
              onClick={handleCreate}
              disabled={!title.trim()}
              className="text-[#FF6A5C] hover:text-white font-display font-semibold disabled:opacity-40"
            >
              Crear en {stages[0]?.name ?? "la primera etapa"}
            </button>
            <button onClick={() => setAdding(false)} className="text-[#8A8A8A] hover:text-white">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
