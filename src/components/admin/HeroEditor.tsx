"use client";

import { useState } from "react";
import { updateHeroContent } from "@/app/admin/actions";
import type { HeroContent } from "@/lib/types";

function Field({
  label,
  name,
  value,
  onChange,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5">
        {label}
      </label>
      {hint && <p className="text-xs text-[#8A8A8A]/70 mb-2">{hint}</p>}
      <input
        name={name}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-4 py-3 text-white focus:border-[#E8231A] focus:outline-none transition-colors"
      />
    </div>
  );
}

export default function HeroEditor({ initial }: { initial: HeroContent }) {
  const [form, setForm] = useState({ ...initial, hero_image_url: initial.hero_image_url ?? "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function set(key: keyof HeroContent) {
    return (value: string) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setSaved(false);
    };
  }

  async function handleSave() {
    setSaving(true);
    await updateHeroContent(form);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Eyebrow */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-5">
        <h2 className="font-display font-bold text-base text-white mb-1">Eyebrow / Badge</h2>
        <Field
          label="Texto del badge"
          name="badge_text"
          value={form.badge_text}
          onChange={set("badge_text")}
          hint='Aparece arriba del título en rojo. Ej: "Soluciones POS & Retail Tech"'
        />
      </div>

      {/* Headline */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-5">
        <h2 className="font-display font-bold text-base text-white mb-1">Título principal</h2>
        <Field label="Línea 1" name="headline_line1" value={form.headline_line1} onChange={set("headline_line1")} />
        <Field label="Línea 2" name="headline_line2" value={form.headline_line2} onChange={set("headline_line2")} />
        <Field
          label="Línea 3 (en rojo)"
          name="headline_red"
          value={form.headline_red}
          onChange={set("headline_red")}
          hint="Esta línea se muestra en rojo FORCOM"
        />
      </div>

      {/* Subheadline */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
        <h2 className="font-display font-bold text-base text-white mb-4">Bajada / Subtítulo</h2>
        <label className="block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5">
          Texto descriptivo
        </label>
        <textarea
          value={form.subheadline}
          onChange={(e) => set("subheadline")(e.target.value)}
          rows={3}
          className="w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-4 py-3 text-white focus:border-[#E8231A] focus:outline-none transition-colors resize-none"
        />
      </div>

      {/* CTAs */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-5">
        <h2 className="font-display font-bold text-base text-white mb-1">Botones CTA</h2>
        <Field label="Botón primario (rojo)" name="cta_primary" value={form.cta_primary} onChange={set("cta_primary")} />
        <Field label="Botón secundario (borde)" name="cta_secondary" value={form.cta_secondary} onChange={set("cta_secondary")} />
      </div>

      {/* Trust bar */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-5">
        <h2 className="font-display font-bold text-base text-white mb-1">Barra de confianza</h2>
        <Field label="Item 1" name="trust_item_1" value={form.trust_item_1} onChange={set("trust_item_1")} />
        <Field label="Item 2" name="trust_item_2" value={form.trust_item_2} onChange={set("trust_item_2")} />
        <Field label="Item 3" name="trust_item_3" value={form.trust_item_3} onChange={set("trust_item_3")} />
      </div>

      {/* Imagen Hero */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-4">
        <h2 className="font-display font-bold text-base text-white">Imagen del Hero</h2>
        <p className="text-xs text-[#8A8A8A]">
          Subí la imagen a <code className="bg-[#0D0D0F] px-1.5 py-0.5 rounded text-[#B0B0B0]">/public/images/</code> y pegá la ruta aquí. También podés usar una URL externa (https://...).
        </p>
        <Field
          label="URL o ruta de imagen"
          name="hero_image_url"
          value={form.hero_image_url ?? ""}
          onChange={set("hero_image_url")}
          hint='Ej: /images/hero-pos.png  ·  Tamaño recomendado: 800 × 800 px (cuadrada, fondo transparente o negro)'
        />
        {/* Preview */}
        {form.hero_image_url && (
          <div className="mt-3">
            <p className="text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">Preview</p>
            <div className="w-48 h-36 bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.hero_image_url}
                alt="Hero preview"
                className="w-full h-full object-contain p-2"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  (e.currentTarget.nextSibling as HTMLElement | null)?.removeAttribute("style");
                }}
              />
              <p className="text-xs text-[#8A8A8A] hidden" style={{ display: "none" }}>
                No se puede cargar la imagen
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 bg-[#E8231A] text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-[#C41D16] transition-colors disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {saved && (
          <span className="text-green-400 text-sm font-display font-semibold flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Guardado
          </span>
        )}
      </div>
    </div>
  );
}
