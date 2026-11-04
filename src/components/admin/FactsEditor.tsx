"use client";

import { useState } from "react";
import { saveFacts } from "@/app/admin/actions";
import type { Fact } from "@/lib/types";
import { MAX_FACTS } from "@/lib/site-forms";
import { useFormGuard } from "@/lib/hooks/useUnsavedChanges";
import { useToast } from "./Toast";

type Row = { key: string; id?: string; title: string; text: string };

const toRows = (facts: Fact[]): Row[] => facts.map((f) => ({ key: f.id, id: f.id, title: f.title, text: f.text }));

const inputCls =
  "w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-4 py-2.5 text-white text-[15px] focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none transition-colors";
const labelCls = "block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5";

/**
 * La franja de datos de debajo de la portada ("12 meses", "Todo el país"…). Arranca vacía y, vacía, no se muestra.
 * Se edita entera y se guarda de una vez: así el orden y los borrados se
 * aplican juntos.
 */
export default function FactsEditor({ initial }: { initial: Fact[] }) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>(toRows(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { dirty, markSaved } = useFormGuard(rows, "La franja de datos tiene cambios sin guardar.");

  function update(i: number, key: "title" | "text", value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= rows.length) return;
    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const result = await saveFacts(rows.map(({ id, title, text }) => ({ id, title, text })));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const saved = toRows(result.facts);
      setRows(saved);
      markSaved(saved);
      toast.show("Franja guardada", {
        detail: saved.length ? "Ya se ve en el sitio" : "Quedó vacía: no se muestra en el sitio",
      });
    } catch {
      setError("No se pudo guardar. Revisá la conexión y probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-4">
      {/* Vista previa con el aspecto del sitio */}
      {rows.some((r) => r.title.trim()) && (
        <div className="bg-[#141416] rounded-sm border border-[#2A2A2E] overflow-x-auto">
          <div className="flex min-w-max">
            {rows
              .filter((r) => r.title.trim())
              .map((r, i) => (
                <div key={r.key} className={`px-5 py-4 min-w-[150px] ${i > 0 ? "border-l border-[#2A2A2E]" : ""}`}>
                  <p className="font-display font-extrabold text-[22px] leading-tight uppercase text-[#FFFFFF]">{r.title}</p>
                  <p className="text-[13px] text-[#8A8A8A]">{r.text}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <p className="py-10 text-center border border-dashed border-[#2A2A2E] rounded-sm text-[15px] text-[#8A8A8A]">
          Sin datos: la franja no se muestra en el sitio.
        </p>
      )}

      <ol className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.key} className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-4 flex gap-3 items-start">
            <span className="text-[13px] text-[#8A8A8A] tabular-nums pt-9 w-4 text-center shrink-0">{i + 1}</span>
            <div className="flex-1 grid sm:grid-cols-[200px_1fr] gap-3 min-w-0">
              <label className="block">
                <span className={labelCls}>Dato</span>
                <input className={inputCls} value={r.title} onChange={(e) => update(i, "title", e.target.value)} placeholder="12 meses" />
              </label>
              <label className="block">
                <span className={labelCls}>Aclaración</span>
                <input
                  className={inputCls}
                  value={r.text}
                  onChange={(e) => update(i, "text", e.target.value)}
                  placeholder="De garantía directa de fábrica"
                />
              </label>
            </div>
            <div className="flex flex-col pt-7">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label={`Subir el dato ${i + 1}`}
                className="p-1 text-[#8A8A8A] hover:text-white disabled:opacity-30"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === rows.length - 1}
                aria-label={`Bajar el dato ${i + 1}`}
                className="p-1 text-[#8A8A8A] hover:text-white disabled:opacity-30"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
              aria-label={`Quitar el dato ${i + 1}`}
              title="Quitar"
              className="mt-7 p-2 text-[#8A8A8A] hover:text-[#FF6A5C] hover:bg-[#E8231A]/10 rounded-sm transition-colors"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </li>
        ))}
      </ol>

      {rows.length < MAX_FACTS && (
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { key: `nuevo-${Date.now()}`, title: "", text: "" }])}
          className="w-full py-3 border border-dashed border-[#2A2A2E] rounded-sm text-[15px] text-[#B0B0B0] hover:text-white hover:border-[#8A8A8A] transition-colors"
        >
          + Agregar dato
        </button>
      )}
      <p className="text-[13px] text-[#8A8A8A]">
        Hasta {MAX_FACTS}. Con 4 se ven en una fila en la computadora; en el teléfono van de a dos. Los cambios se ven en el sitio recién al guardar.
      </p>

      {error && (
        <p role="alert" className="text-[15px] text-[#FF6A5C] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={saving || !dirty}
          className="px-8 py-3 bg-[#C41D16] text-white font-display font-bold text-[15px] tracking-widest uppercase rounded-sm hover:bg-[#E8231A] transition-colors disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar franja"}
        </button>
        {!dirty && <span className="text-[13px] text-[#8A8A8A]">Sin cambios</span>}
      </div>
    </form>
  );
}
