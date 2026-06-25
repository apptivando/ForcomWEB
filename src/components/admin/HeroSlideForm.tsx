"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { createHeroSlide, updateHeroSlide } from "@/app/admin/actions";
import type { HeroSlide } from "@/lib/types";

const CATEGORY_OPTIONS = [
  { label: "— Todos los productos —", value: "" },
  { label: "Smart POS — Terminales Inteligentes", value: "cat-smart-pos" },
  { label: "Mini PC — Computación Compacta", value: "cat-mini-pc" },
  { label: "Impresoras — Térmica & Etiquetas", value: "cat-impresoras" },
  { label: "Lectores de Escritorio", value: "cat-lectores" },
  { label: "Lectores de Mano", value: "cat-lectores-mano" },
  { label: "Verificadores de Precio", value: "cat-verificadores" },
  { label: "Balanzas", value: "cat-balanzas" },
  { label: "Accesorios", value: "cat-accesorios" },
];

interface Props {
  slide: HeroSlide | null;
  slideCount: number;
  onSave: (slide: HeroSlide) => void;
  onClose: () => void;
}

interface FormData {
  badge_text: string;
  headline_line1: string;
  headline_line2: string;
  headline_accent: string;
  subheadline: string;
  cta_label: string;
  cta_category: string;
  cta_url: string;
  image_url: string;
  image_alt: string;
  image_tag: string;
  active: boolean;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5">
        {label}
      </label>
      {hint && <p className="text-xs text-[#8A8A8A]/70 mb-2">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-4 py-2.5 text-white text-sm focus:border-[#E8231A] focus:outline-none transition-colors";

export default function HeroSlideForm({ slide, slideCount, onSave, onClose }: Props) {
  const [form, setForm] = useState<FormData>({
    badge_text: slide?.badge_text ?? "",
    headline_line1: slide?.headline_line1 ?? "",
    headline_line2: slide?.headline_line2 ?? "",
    headline_accent: slide?.headline_accent ?? "",
    subheadline: slide?.subheadline ?? "",
    cta_label: slide?.cta_label ?? "Ver productos",
    cta_category: slide?.cta_category ?? "",
    cta_url: slide?.cta_url ?? "",
    image_url: slide?.image_url ?? "",
    image_alt: slide?.image_alt ?? "",
    image_tag: slide?.image_tag ?? "",
    active: slide?.active ?? true,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(slide?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const prev = imagePreview;
    if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
    setImagePreview(URL.createObjectURL(file));
  }

  async function uploadImage(): Promise<string | null> {
    if (!imageFile) return form.image_url || null;

    const supabase = createClient();
    const ext = imageFile.name.split(".").pop() ?? "png";
    const path = `${crypto.randomUUID()}.${ext}`;

    setUploading(true);
    const { data, error } = await supabase.storage
      .from("hero-slides")
      .upload(path, imageFile, { upsert: false });
    setUploading(false);

    if (error) throw new Error(`Error al subir imagen: ${error.message}`);

    const {
      data: { publicUrl },
    } = supabase.storage.from("hero-slides").getPublicUrl(data.path);

    return publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      const imageUrl = await uploadImage();

      const payload = {
        badge_text: form.badge_text,
        headline_line1: form.headline_line1,
        headline_line2: form.headline_line2,
        headline_accent: form.headline_accent,
        subheadline: form.subheadline,
        cta_label: form.cta_label,
        cta_category: form.cta_category || null,
        cta_url: form.cta_url || null,
        image_url: imageUrl,
        image_alt: form.image_alt,
        image_tag: form.image_tag,
        active: form.active,
        order_index: slide?.order_index ?? slideCount,
      };

      const saved = slide
        ? await updateHeroSlide(slide.id, payload)
        : await createHeroSlide(payload);

      onSave(saved);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar el slide.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#141416] border border-[#2A2A2E] rounded-sm flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2E] flex-shrink-0">
          <div>
            <h2 className="font-display font-bold text-lg text-white">
              {slide ? "Editar slide" : "Nuevo slide"}
            </h2>
            <p className="text-xs text-[#8A8A8A] mt-0.5">
              {slide ? `Modificando: ${slide.badge_text}` : "Se agregará al final del carrusel"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8A8A8A] hover:text-white hover:bg-[#1A1A1E] rounded-sm transition-colors"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <form id="hero-slide-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {/* Badge */}
          <Field label="Badge / eyebrow" hint='Texto pequeño en rojo sobre el título. Ej: "Smart POS — Terminales Inteligentes"'>
            <input
              type="text"
              value={form.badge_text}
              onChange={(e) => set("badge_text", e.target.value)}
              className={inputCls}
              required
              placeholder="Smart POS — Terminales Inteligentes"
            />
          </Field>

          {/* Headline */}
          <div className="space-y-3 p-4 bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm">
            <p className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">
              Título — 3 líneas
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Línea 1">
                <input
                  type="text"
                  value={form.headline_line1}
                  onChange={(e) => set("headline_line1", e.target.value)}
                  className={inputCls}
                  required
                  placeholder="Tecnología"
                />
              </Field>
              <Field label="Línea 2">
                <input
                  type="text"
                  value={form.headline_line2}
                  onChange={(e) => set("headline_line2", e.target.value)}
                  className={inputCls}
                  required
                  placeholder="que entiende"
                />
              </Field>
            </div>
            <Field label="Línea 3 (en rojo FORCOM)">
              <input
                type="text"
                value={form.headline_accent}
                onChange={(e) => set("headline_accent", e.target.value)}
                className={inputCls}
                required
                placeholder="su negocio"
              />
            </Field>
            {/* Live preview */}
            {(form.headline_line1 || form.headline_line2 || form.headline_accent) && (
              <div className="mt-2 px-4 py-3 bg-[#141416] border border-[#2A2A2E] rounded-sm">
                <p className="text-[10px] font-display tracking-[0.15em] uppercase text-[#8A8A8A] mb-1">Vista previa</p>
                <p className="font-display font-extrabold text-2xl leading-tight text-white">
                  {form.headline_line1}
                  {form.headline_line2 && <> <br />{form.headline_line2}</>}
                  {form.headline_accent && (
                    <>
                      {" "}
                      <br />
                      <span className="text-[#E8231A]">{form.headline_accent}</span>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Subheadline */}
          <Field label="Descripción / subtítulo">
            <textarea
              value={form.subheadline}
              onChange={(e) => set("subheadline", e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              required
              placeholder="Descripción breve del producto o categoría..."
            />
          </Field>

          {/* CTA */}
          <div className="space-y-3 p-4 bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm">
            <p className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">
              Botón CTA
            </p>
            <Field label="Texto del botón">
              <input
                type="text"
                value={form.cta_label}
                onChange={(e) => set("cta_label", e.target.value)}
                className={inputCls}
                required
                placeholder="Ver terminales"
              />
            </Field>
            <Field label="Categoría de destino">
              <select
                value={form.cta_category}
                onChange={(e) => set("cta_category", e.target.value)}
                className={`${inputCls} cursor-pointer`}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="URL personalizada (opcional)"
              hint="Si se completa, tiene prioridad sobre la categoría seleccionada. Puede ser una sección (#contacto) o URL externa."
            >
              <input
                type="text"
                value={form.cta_url}
                onChange={(e) => set("cta_url", e.target.value)}
                className={inputCls}
                placeholder="#contacto  o  https://..."
              />
            </Field>
          </div>

          {/* Image */}
          <div className="space-y-4 p-4 bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm">
            <p className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">
              Imagen del producto
            </p>
            <p className="text-xs text-[#8A8A8A]/70">
              Se sube al bucket <code className="bg-[#141416] px-1 rounded text-[#B0B0B0]">hero-slides</code> de Supabase Storage.
              Recomendado: PNG 800×800 px con fondo transparente.
            </p>

            {/* Preview */}
            <div className="w-36 h-28 bg-[#141416] border border-[#2A2A2E] rounded-sm overflow-hidden flex items-center justify-center">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-contain p-2" />
              ) : (
                <svg className="w-8 h-8 text-[#2A2A2E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                </svg>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-4 py-2 border border-[#2A2A2E] text-[#B0B0B0] text-sm font-display font-semibold rounded-sm hover:border-[#E8231A] hover:text-white transition-colors"
              >
                {imagePreview ? "Cambiar imagen" : "Subir imagen"}
              </button>
              {imageFile && (
                <span className="text-xs text-[#8A8A8A] truncate max-w-xs">{imageFile.name}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Etiqueta sobre la imagen (opcional)">
                <input
                  type="text"
                  value={form.image_tag}
                  onChange={(e) => set("image_tag", e.target.value)}
                  className={inputCls}
                  placeholder='INTEL CORE i7 · 18.5" TOUCH'
                />
              </Field>
              <Field label="Alt text">
                <input
                  type="text"
                  value={form.image_alt}
                  onChange={(e) => set("image_alt", e.target.value)}
                  className={inputCls}
                  placeholder="FORCOM A6 G2 Smart-POS"
                />
              </Field>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set("active", !form.active)}
              className={`relative w-11 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8231A] ${
                form.active ? "bg-[#E8231A]" : "bg-[#2A2A2E]"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  form.active ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm text-[#B0B0B0] font-display">
              {form.active ? "Activo — se muestra en el carrusel" : "Inactivo — oculto en el sitio"}
            </span>
          </div>

          {formError && (
            <p className="text-sm text-[#E8231A] bg-[#E8231A]/10 border border-[#E8231A]/30 rounded-sm px-4 py-3">
              {formError}
            </p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2A2A2E] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-[#2A2A2E] text-[#B0B0B0] text-sm font-display font-semibold rounded-sm hover:text-white hover:border-[#8A8A8A] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="hero-slide-form"
            disabled={saving || uploading}
            className="px-6 py-2.5 bg-[#E8231A] text-white text-sm font-display font-bold tracking-wider uppercase rounded-sm hover:bg-[#C41D16] transition-colors disabled:opacity-50"
          >
            {uploading ? "Subiendo imagen..." : saving ? "Guardando..." : slide ? "Guardar cambios" : "Crear slide"}
          </button>
        </div>
      </div>
    </div>
  );
}
