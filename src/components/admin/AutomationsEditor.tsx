"use client";

import { useState, useTransition } from "react";
import {
  upsertAutomation,
  toggleAutomationActive,
  deleteAutomation,
} from "@/app/admin/actions";
import type { Automation, AutomationStep } from "@/lib/types";

const inputCls =
  "w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-3 py-2 text-sm text-white placeholder:text-[#8A8A8A]/50 focus:border-[#E8231A] focus:outline-none transition-colors";
const labelCls =
  "block text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1";

const ACTION_LABEL: Record<AutomationStep["action_type"], string> = {
  send_message: "Mandar mensaje",
  wait: "Esperar",
  assign_agent: "Asignar a",
};

function emptyStep(): AutomationStep {
  return { step_index: 0, action_type: "send_message", message_text: "", wait_minutes: null, assign_member_id: null };
}

export default function AutomationsEditor({
  initialAutomations,
  members,
}: {
  initialAutomations: Automation[];
  members: { user_id: string; email: string }[];
}) {
  const [, startTransition] = useTransition();
  const [automations, setAutomations] = useState(initialAutomations);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function handleToggle(id: string, active: boolean) {
    setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, active } : a)));
    startTransition(async () => {
      try {
        await toggleAutomationActive(id, active);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cambiar.");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Borrar esta automatización?")) return;
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    startTransition(async () => {
      try {
        await deleteAutomation(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al borrar.");
      }
    });
  }

  const editingAutomation = automations.find((a) => a.id === editingId) ?? null;

  return (
    <div className="max-w-2xl space-y-4">
      {error && (
        <p className="text-sm text-[#E8231A] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3">
          {error}
        </p>
      )}

      {!creating && !editingAutomation && (
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-[#E8231A] text-white text-xs font-display font-bold tracking-widest uppercase rounded-sm hover:bg-[#C41D16] transition-colors"
        >
          + Nueva automatización
        </button>
      )}

      {(creating || editingAutomation) && (
        <AutomationForm
          automation={editingAutomation}
          members={members}
          onCancel={() => {
            setCreating(false);
            setEditingId(null);
          }}
          onSaved={(saved) => {
            setAutomations((prev) => {
              const exists = prev.some((a) => a.id === saved.id);
              return exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev];
            });
            setCreating(false);
            setEditingId(null);
          }}
          setError={setError}
        />
      )}

      <div className="space-y-2">
        {automations.length === 0 && !creating && (
          <p className="text-sm text-[#8A8A8A]">Todavía no hay automatizaciones.</p>
        )}
        {automations.map((a) => (
          <div key={a.id} className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-display font-semibold text-white text-sm">{a.name}</p>
                <p className="text-xs text-[#8A8A8A] mt-1">
                  {a.trigger_type === "keyword_match"
                    ? `Palabra clave: ${(a.trigger_keywords ?? []).join(", ")}`
                    : "Conversación nueva"}
                  {" · "}
                  {a.steps.length} paso{a.steps.length !== 1 ? "s" : ""}
                  {" ("}
                  {a.steps.map((s) => ACTION_LABEL[s.action_type]).join(" → ")}
                  {")"}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => handleToggle(a.id, !a.active)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${a.active ? "bg-[#E8231A]" : "bg-[#2A2A2E]"}`}
                  title={a.active ? "Activa" : "Pausada"}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      a.active ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <button onClick={() => setEditingId(a.id)} className="text-xs text-[#8A8A8A] hover:text-white">
                  Editar
                </button>
                <button onClick={() => handleDelete(a.id)} className="text-xs text-[#8A8A8A] hover:text-[#E8231A]">
                  Borrar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AutomationForm({
  automation,
  members,
  onCancel,
  onSaved,
  setError,
}: {
  automation: Automation | null;
  members: { user_id: string; email: string }[];
  onCancel: () => void;
  onSaved: (a: Automation) => void;
  setError: (e: string) => void;
}) {
  const [, startTransition] = useTransition();
  const [name, setName] = useState(automation?.name ?? "");
  const [triggerType, setTriggerType] = useState<Automation["trigger_type"]>(automation?.trigger_type ?? "keyword_match");
  const [keywords, setKeywords] = useState((automation?.trigger_keywords ?? []).join(", "));
  const [steps, setSteps] = useState<AutomationStep[]>(automation?.steps.length ? automation.steps : [emptyStep()]);
  const [saving, setSaving] = useState(false);

  function updateStep(i: number, patch: Partial<AutomationStep>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, emptyStep()]);
  }

  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || steps.length === 0) return;
    setSaving(true);
    startTransition(async () => {
      try {
        const keywordList = keywords.split(",").map((k) => k.trim()).filter(Boolean);
        await upsertAutomation(automation?.id ?? null, {
          name,
          trigger_type: triggerType,
          trigger_keywords: keywordList,
          steps,
        });
        onSaved({
          id: automation?.id ?? crypto.randomUUID(),
          name: name.trim(),
          trigger_type: triggerType,
          trigger_keywords: triggerType === "keyword_match" ? keywordList : null,
          active: automation?.active ?? true,
          created_at: automation?.created_at ?? new Date().toISOString(),
          steps,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar.");
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#141416] border border-[#E8231A]/40 rounded-sm p-6 space-y-4">
      <div>
        <label className={labelCls}>Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Bienvenida por palabra clave" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Se dispara cuando</label>
          <select value={triggerType} onChange={(e) => setTriggerType(e.target.value as Automation["trigger_type"])} className={inputCls}>
            <option value="keyword_match">El mensaje contiene una palabra clave</option>
            <option value="new_conversation">Empieza una conversación nueva</option>
          </select>
        </div>
        {triggerType === "keyword_match" && (
          <div>
            <label className={labelCls}>Palabras clave (separadas por coma)</label>
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className={inputCls} placeholder="precio, horario" />
          </div>
        )}
      </div>

      <div>
        <label className={labelCls}>Pasos (en orden)</label>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm p-3 space-y-2">
              <div className="flex items-center justify-between">
                <select
                  value={step.action_type}
                  onChange={(e) => updateStep(i, { action_type: e.target.value as AutomationStep["action_type"] })}
                  className="bg-[#141416] border border-[#2A2A2E] rounded-sm px-2 py-1.5 text-xs text-white focus:border-[#E8231A] focus:outline-none"
                >
                  <option value="send_message">Mandar mensaje</option>
                  <option value="wait">Esperar</option>
                  <option value="assign_agent">Asignar a</option>
                </select>
                {steps.length > 1 && (
                  <button type="button" onClick={() => removeStep(i)} className="text-[11px] text-[#8A8A8A] hover:text-[#E8231A]">
                    Quitar paso
                  </button>
                )}
              </div>

              {step.action_type === "send_message" && (
                <textarea
                  value={step.message_text ?? ""}
                  onChange={(e) => updateStep(i, { message_text: e.target.value })}
                  rows={2}
                  className={`${inputCls} resize-none`}
                  placeholder="Texto del mensaje"
                />
              )}
              {step.action_type === "wait" && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={step.wait_minutes ?? ""}
                    onChange={(e) => updateStep(i, { wait_minutes: Number(e.target.value) })}
                    className={`${inputCls} max-w-[120px]`}
                  />
                  <span className="text-xs text-[#8A8A8A]">minutos</span>
                </div>
              )}
              {step.action_type === "assign_agent" && (
                <select
                  value={step.assign_member_id ?? ""}
                  onChange={(e) => updateStep(i, { assign_member_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Elegir persona...</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.email}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addStep} className="text-xs text-[#E8231A] hover:underline mt-2">
          + Agregar paso
        </button>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-[#E8231A] text-white text-sm font-display font-bold rounded-sm hover:bg-[#C41D16] disabled:opacity-50"
        >
          Guardar
        </button>
        <button type="button" onClick={onCancel} className="px-6 py-2.5 text-sm text-[#8A8A8A] hover:text-white">
          Cancelar
        </button>
      </div>
    </form>
  );
}
