"use client";

import { useState, useTransition } from "react";
import {
  upsertAutomation,
  toggleAutomationActive,
  deleteAutomation,
} from "@/app/admin/actions";
import type { Automation, AutomationStep } from "@/lib/types";
import Toggle from "@/components/admin/Toggle";

const inputCls =
  "w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-3 py-2 text-[15px] text-white placeholder:text-[#8A8A8A]/50 focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none transition-colors";
const labelCls =
  "block text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1";

const ACTION_LABEL: Record<AutomationStep["action_type"], string> = {
  send_message: "Mandar mensaje",
  wait: "Esperar",
  assign_agent: "Asignar a",
};

function emptyStep(): AutomationStep {
  return { step_index: 0, action_type: "send_message", message_text: "", wait_minutes: null, assign_member_id: null };
}

/**
 * Ejemplo con el que arranca el estado vacío.
 *
 * El estado vacío de esta sección era una línea de texto —"Todavía no hay
 * automatizaciones."— justo donde un panel que recién arranca más necesita que
 * le expliquen para qué sirve. Acá el estado vacío ES la documentación: se ve
 * una automatización concreta y el botón la carga en el formulario para
 * editarla, en vez de partir de una pantalla en blanco.
 */
const EJEMPLO: AutomationPrefill = {
  name: "Bienvenida automática",
  trigger_type: "new_conversation",
  trigger_keywords: [],
  steps: [
    {
      step_index: 0,
      action_type: "send_message",
      message_text:
        "¡Hola! Gracias por escribir a FORCOM. Atendemos de lunes a viernes de 9 a 18. Un vendedor te responde a la brevedad.",
      wait_minutes: null,
      assign_member_id: null,
    },
  ],
};

/** Valores iniciales del formulario cuando se crea desde un ejemplo. */
type AutomationPrefill = Pick<Automation, "name" | "trigger_type" | "trigger_keywords" | "steps">;

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
  // Valores con los que abrir el formulario cuando se crea desde el ejemplo.
  const [prefill, setPrefill] = useState<AutomationPrefill | null>(null);
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
    <div className="max-w-form space-y-4">
      {error && (
        <p className="text-[15px] text-[#FF6A5C] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3">
          {error}
        </p>
      )}

      {!creating && !editingAutomation && (
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-[#C41D16] text-white text-xs font-display font-bold tracking-widest uppercase rounded-sm hover:bg-[#E8231A] transition-colors"
        >
          + Nueva automatización
        </button>
      )}

      {(creating || editingAutomation) && (
        <AutomationForm
          automation={editingAutomation}
          prefill={prefill}
          members={members}
          onCancel={() => {
            setCreating(false);
            setEditingId(null);
            setPrefill(null);
          }}
          onSaved={(saved) => {
            setAutomations((prev) => {
              const exists = prev.some((a) => a.id === saved.id);
              return exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev];
            });
            setCreating(false);
            setEditingId(null);
            setPrefill(null);
          }}
          setError={setError}
        />
      )}

      <div className="space-y-2">
        {automations.length === 0 && !creating && (
          // El estado vacío es la primera pantalla que ve la sección en un
          // panel que todavía no está en producción: es documentación, no
          // decoración.
          <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
            <p className="font-display font-semibold text-white mb-1">
              Todavía no hay automatizaciones
            </p>
            <p className="text-[15px] text-[#B0B0B0] mb-4">
              Una automatización mira lo que entra por WhatsApp y responde sola. Por
              ejemplo: <em>cuando alguien escribe por primera vez, contestar con el
              horario de atención</em>. Este es el caso más común y sirve como punto
              de partida.
            </p>
            <div className="bg-[#0D0D0F] border border-[#6A6A70] rounded-sm p-4 mb-4 text-[13px] text-[#8A8A8A] space-y-1">
              <p>
                <span className="text-[#B0B0B0]">Se dispara cuando:</span> empieza una
                conversación nueva
              </p>
              <p>
                <span className="text-[#B0B0B0]">Paso 1:</span> mandar “{EJEMPLO.steps[0].message_text}”
              </p>
            </div>
            <button
              onClick={() => {
                setPrefill(EJEMPLO);
                setCreating(true);
              }}
              className="px-4 py-2 bg-[#C41D16] text-white text-xs font-display font-bold tracking-widest uppercase rounded-sm hover:bg-[#E8231A] transition-colors"
            >
              Crear esta automatización
            </button>
            <p className="text-[13px] text-[#8A8A8A] mt-2">
              Se abre el formulario ya cargado — podés cambiar el texto antes de
              guardar, y queda pausada hasta que la actives.
            </p>
          </div>
        )}
        {automations.map((a) => (
          <div key={a.id} className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-display font-semibold text-white text-[15px]">{a.name}</p>
                <p className="text-[13px] text-[#8A8A8A] mt-1">
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
                <Toggle
                  size="sm"
                  checked={a.active}
                  onChange={(next) => handleToggle(a.id, next)}
                  label={`${a.name}: ${a.active ? "activa" : "pausada"}`}
                />
                <button onClick={() => setEditingId(a.id)} className="text-[13px] text-[#8A8A8A] hover:text-white">
                  Editar
                </button>
                <button onClick={() => handleDelete(a.id)} className="text-[13px] text-[#8A8A8A] hover:text-[#FF6A5C]">
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
  prefill,
  members,
  onCancel,
  onSaved,
  setError,
}: {
  automation: Automation | null;
  /** Valores iniciales al crear desde el ejemplo del estado vacío. Nunca trae
   *  `id`: lo que se guarda es una automatización nueva, no una edición. */
  prefill: AutomationPrefill | null;
  members: { user_id: string; email: string }[];
  onCancel: () => void;
  onSaved: (a: Automation) => void;
  setError: (e: string) => void;
}) {
  // `automation` (edición) gana sobre `prefill` (ejemplo); si no hay ninguno,
  // el formulario arranca vacío.
  const inicial = automation ?? prefill;
  const [, startTransition] = useTransition();
  const [name, setName] = useState(inicial?.name ?? "");
  const [triggerType, setTriggerType] = useState<Automation["trigger_type"]>(inicial?.trigger_type ?? "keyword_match");
  const [keywords, setKeywords] = useState((inicial?.trigger_keywords ?? []).join(", "));
  const [steps, setSteps] = useState<AutomationStep[]>(inicial?.steps.length ? inicial.steps : [emptyStep()]);
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
        <label htmlFor="nombre" className={labelCls}>Nombre</label>
        <input id="nombre" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Bienvenida por palabra clave" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="se-dispara-cuando" className={labelCls}>Se dispara cuando</label>
          <select id="se-dispara-cuando" value={triggerType} onChange={(e) => setTriggerType(e.target.value as Automation["trigger_type"])} className={inputCls}>
            <option value="keyword_match">El mensaje contiene una palabra clave</option>
            <option value="new_conversation">Empieza una conversación nueva</option>
          </select>
        </div>
        {triggerType === "keyword_match" && (
          <div>
            <label htmlFor="palabras-clave-separadas-por" className={labelCls}>Palabras clave (separadas por coma)</label>
            <input id="palabras-clave-separadas-por" value={keywords} onChange={(e) => setKeywords(e.target.value)} className={inputCls} placeholder="precio, horario" />
          </div>
        )}
      </div>

      <div>
        <p className={labelCls}>Pasos (en orden)</p>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="bg-[#0D0D0F] border border-[#6A6A70] rounded-sm p-3 space-y-2">
              <div className="flex items-center justify-between">
                <select aria-label={`Paso ${i + 1}: qué hace`}
                  value={step.action_type}
                  onChange={(e) => updateStep(i, { action_type: e.target.value as AutomationStep["action_type"] })}
                  className="bg-[#141416] border border-[#2A2A2E] rounded-sm px-2 py-1.5 text-[13px] text-white focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none"
                >
                  <option value="send_message">Mandar mensaje</option>
                  <option value="wait">Esperar</option>
                  <option value="assign_agent">Asignar a</option>
                </select>
                {steps.length > 1 && (
                  <button type="button" onClick={() => removeStep(i)} className="text-[13px] text-[#8A8A8A] hover:text-[#FF6A5C]">
                    Quitar paso
                  </button>
                )}
              </div>

              {step.action_type === "send_message" && (
                <textarea aria-label={`Paso ${i + 1}: texto del mensaje`}
                  value={step.message_text ?? ""}
                  onChange={(e) => updateStep(i, { message_text: e.target.value })}
                  rows={2}
                  className={`${inputCls} resize-none`}
                  placeholder="Texto del mensaje"
                />
              )}
              {step.action_type === "wait" && (
                <div className="flex items-center gap-2">
                  <input aria-label={`Paso ${i + 1}: minutos de espera`}
                    type="number"
                    min={1}
                    value={step.wait_minutes ?? ""}
                    onChange={(e) => updateStep(i, { wait_minutes: Number(e.target.value) })}
                    className={`${inputCls} max-w-[120px]`}
                  />
                  <span className="text-[13px] text-[#8A8A8A]">minutos</span>
                </div>
              )}
              {step.action_type === "assign_agent" && (
                <select aria-label={`Paso ${i + 1}: a quién se asigna`}
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
        <button type="button" onClick={addStep} className="text-[13px] text-[#FF6A5C] hover:underline mt-2">
          + Agregar paso
        </button>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-[#C41D16] text-white text-[15px] font-display font-bold rounded-sm hover:bg-[#E8231A] disabled:opacity-50"
        >
          Guardar
        </button>
        <button type="button" onClick={onCancel} className="px-6 py-2.5 text-[15px] text-[#8A8A8A] hover:text-white">
          Cancelar
        </button>
      </div>
    </form>
  );
}
