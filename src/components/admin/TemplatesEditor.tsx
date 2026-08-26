"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertOutreachTemplate, deleteOutreachTemplate } from "@/app/admin/outreach-actions";
import type { OutreachTemplate } from "@/lib/types";

const STATUS_STYLE: Record<OutreachTemplate["status"], { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-[#2A2A2E] text-[#B0B0B0] border-[#2A2A2E]" },
  enviada: { label: "Esperando a Meta", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  aprobada: { label: "Aprobada", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  rechazada: { label: "Rechazada", className: "bg-[#E8231A]/10 text-[#FF6A5C] border-[#E8231A]/20" },
};

const field =
  "bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-3 py-2 text-[15px] text-white placeholder:text-[#8A8A8A] focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none";

const EMPTY = {
  id: undefined as string | undefined,
  name: "",
  meta_template_name: "",
  language: "es_AR",
  category: "marketing" as OutreachTemplate["category"],
  status: "borrador" as OutreachTemplate["status"],
  rejection_reason: "",
  body: "",
  variablesText: "",
  active: true,
};

function toForm(t: OutreachTemplate) {
  return {
    id: t.id,
    name: t.name,
    meta_template_name: t.meta_template_name ?? "",
    language: t.language,
    category: t.category,
    status: t.status,
    rejection_reason: t.rejection_reason ?? "",
    body: t.body,
    variablesText: t.variables.join(", "),
    active: t.active,
  };
}

export default function TemplatesEditor({
  templates,
  canEdit,
}: {
  templates: OutreachTemplate[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Los marcadores se numeran por posición, así que el orden de la lista de
  // variables importa: la primera describe {{1}}, la segunda {{2}}, etc.
  const variables = form
    ? form.variablesText.split(",").map((v) => v.trim()).filter(Boolean)
    : [];
  const usedMarkers = form ? [...form.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])) : [];
  const maxMarker = usedMarkers.length ? Math.max(...usedMarkers) : 0;
  const mismatch = form ? maxMarker !== variables.length : false;

  async function save() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      await upsertOutreachTemplate({
        id: form.id,
        name: form.name,
        meta_template_name: form.meta_template_name,
        language: form.language,
        category: form.category,
        status: form.status,
        rejection_reason: form.rejection_reason,
        body: form.body,
        variables,
        active: form.active,
      });
      setForm(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {canEdit && !form && (
        <button
          onClick={() => setForm({ ...EMPTY })}
          className="px-5 py-2.5 bg-[#C41D16] text-white font-display font-bold text-xs tracking-widest uppercase rounded-sm hover:bg-[#E8231A] transition-colors"
        >
          + Nueva plantilla
        </button>
      )}

      {form && (
        <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className={field}
              placeholder="Nombre interno — ej. Presentación FORCOM"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className={field}
              placeholder="Nombre en Meta — ej. presentacion_forcom"
              value={form.meta_template_name}
              onChange={(e) => setForm({ ...form, meta_template_name: e.target.value })}
            />
            <select
              className={field}
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as OutreachTemplate["category"] })
              }
            >
              <option value="marketing">Marketing — prospección en frío</option>
              <option value="utility">Utility — aviso de algo que el cliente pidió</option>
              <option value="authentication">Authentication — códigos</option>
            </select>
            <select
              className={field}
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as OutreachTemplate["status"] })
              }
            >
              <option value="borrador">Borrador</option>
              <option value="enviada">Enviada a Meta</option>
              <option value="aprobada">Aprobada por Meta</option>
              <option value="rechazada">Rechazada</option>
            </select>
          </div>

          <textarea
            className={`${field} w-full font-mono`}
            rows={6}
            placeholder={"Cuerpo del mensaje. Usá {{1}}, {{2}}… para los datos que se completan solos."}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />

          <input
            className={`${field} w-full`}
            placeholder="Qué representa cada marcador, separado por comas — ej. nombre de contacto, rubro"
            value={form.variablesText}
            onChange={(e) => setForm({ ...form, variablesText: e.target.value })}
          />

          <div className="text-[13px] text-[#8A8A8A] space-y-1">
            <p>
              Se completan solos desde la ficha del cliente cuando la descripción menciona{" "}
              <span className="text-[#B0B0B0]">nombre de contacto</span>,{" "}
              <span className="text-[#B0B0B0]">razón social</span>,{" "}
              <span className="text-[#B0B0B0]">rubro</span> o{" "}
              <span className="text-[#B0B0B0]">localidad</span>. Si el dato falta, el marcador queda
              vacío — nunca se le muestra un <code>{"{{1}}"}</code> a un cliente.
            </p>
            {mismatch && (
              <p className="text-yellow-400">
                El cuerpo usa {maxMarker} marcador(es) y describiste {variables.length}. Revisá que
                coincidan o algunos van a quedar vacíos.
              </p>
            )}
          </div>

          {form.status === "rechazada" && (
            <input
              className={`${field} w-full`}
              placeholder="Motivo del rechazo de Meta"
              value={form.rejection_reason}
              onChange={(e) => setForm({ ...form, rejection_reason: e.target.value })}
            />
          )}

          <label className="flex items-center gap-2 text-[13px] text-[#B0B0B0]">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Activa — aparece al escribirle a un cliente
          </label>

          {error && <p className="text-[13px] text-[#FF6A5C]">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !form.name.trim() || !form.body.trim()}
              className="px-5 py-2 bg-[#C41D16] text-white font-display font-bold text-xs tracking-widest uppercase rounded-sm hover:bg-[#E8231A] disabled:opacity-40 transition-colors"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              onClick={() => setForm(null)}
              className="px-4 py-2 text-[13px] font-semibold text-[#8A8A8A] hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-12 text-center text-[#8A8A8A]">
          Todavía no hay plantillas.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const style = STATUS_STYLE[t.status];
            return (
              <div
                key={t.id}
                className={`bg-[#141416] border rounded-sm p-4 ${
                  t.active ? "border-[#2A2A2E]" : "border-[#1F1F23] opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <p className="font-display font-semibold text-white">{t.name}</p>
                  <span
                    className={`px-2 py-0.5 text-[12px] font-bold tracking-wider uppercase border rounded-sm ${style.className}`}
                  >
                    {style.label}
                  </span>
                  <span className="text-[12px] text-[#8A8A8A] uppercase tracking-wider">
                    {t.category} · {t.language}
                  </span>
                  {!t.active && <span className="text-[12px] text-[#8A8A8A]">inactiva</span>}
                  {t.meta_template_name && (
                    <code className="text-[12px] text-[#8A8A8A]">{t.meta_template_name}</code>
                  )}
                </div>

                <pre className="text-[13px] text-[#B0B0B0] whitespace-pre-wrap font-sans">{t.body}</pre>

                {t.variables.length > 0 && (
                  <p className="text-[12px] text-[#8A8A8A] mt-2">
                    {t.variables.map((v, i) => `{{${i + 1}}} = ${v}`).join(" · ")}
                  </p>
                )}
                {t.rejection_reason && (
                  <p className="text-[13px] text-[#FF6A5C] mt-2">Rechazo: {t.rejection_reason}</p>
                )}

                {canEdit && (
                  <div className="flex gap-3 mt-3 text-[13px]">
                    <button
                      onClick={() => setForm(toForm(t))}
                      className="text-[#B0B0B0] hover:text-white"
                    >
                      Editar
                    </button>
                    {confirmDelete === t.id ? (
                      <>
                        <button
                          onClick={async () => {
                            await deleteOutreachTemplate(t.id);
                            setConfirmDelete(null);
                            router.refresh();
                          }}
                          className="text-[#FF6A5C] hover:text-white"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-[#8A8A8A] hover:text-white"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(t.id)}
                        className="text-[#8A8A8A] hover:text-[#FF6A5C]"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
