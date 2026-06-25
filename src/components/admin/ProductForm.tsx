"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertProduct } from "@/app/admin/actions";
import type { Product, ProductFile } from "@/lib/types";
import ImageGalleryEditor from "@/components/admin/ImageGalleryEditor";

type Section = { label: string; id: string };

const EMPTY_SPECS = ["", "", "", ""];
const EMPTY_VIDEOS = ["", ""];


export default function ProductForm({
  product,
  sections,
}: {
  product: Product | null;
  sections: Section[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedSection = sections.find((s) => s.id === product?.section_id) ?? sections[0];

  const [form, setForm] = useState({
    model: product?.model ?? "",
    category: product?.category ?? "",
    section: product?.section ?? selectedSection.label,
    section_id: product?.section_id ?? selectedSection.id,
    badge: product?.badge ?? "",
    image_url: product?.image_url ?? "",
    images: product?.images?.filter(Boolean) ?? [],
    videos: product?.videos?.length
      ? [...product.videos, ...EMPTY_VIDEOS].slice(0, 2)
      : [...EMPTY_VIDEOS],
    description: product?.description ?? "",
    full_specs: product?.full_specs ?? "",
    files: product?.files ?? ([] as ProductFile[]),
    specs: product?.specs?.length
      ? [...product.specs, ...EMPTY_SPECS].slice(0, 4)
      : [...EMPTY_SPECS],
    active: product?.active ?? true,
    order_index: product?.order_index ?? 0,
  });

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setSpec(i: number, val: string) {
    const specs = [...form.specs];
    specs[i] = val;
    setForm((prev) => ({ ...prev, specs }));
  }

  function setVideo(i: number, val: string) {
    const videos = [...form.videos];
    videos[i] = val;
    setForm((prev) => ({ ...prev, videos }));
  }

  function addFile() {
    setForm((prev) => ({
      ...prev,
      files: [...prev.files, { name: "", url: "", type: "otro" as const }],
    }));
  }

  function setFileField(i: number, key: keyof ProductFile, val: string) {
    const files = [...form.files];
    files[i] = { ...files[i], [key]: val };
    setForm((prev) => ({ ...prev, files }));
  }

  function removeFile(i: number) {
    setForm((prev) => ({ ...prev, files: prev.files.filter((_, idx) => idx !== i) }));
  }

  function handleSectionChange(sectionId: string) {
    const s = sections.find((x) => x.id === sectionId);
    if (s) setForm((prev) => ({ ...prev, section: s.label, section_id: s.id }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.model.trim()) { setError("El modelo es obligatorio."); return; }
    if (!form.category.trim()) { setError("La categoría es obligatoria."); return; }
    setError("");
    setSaving(true);
    startTransition(async () => {
      try {
        await upsertProduct({
          ...(product?.id ? { id: product.id } : {}),
          ...form,
          // Imagen de la tarjeta = primera de la galería (o la url existente como fallback)
          image_url: form.images[0] || form.image_url || null,
          specs: form.specs.filter((s) => s.trim() !== ""),
          images: form.images,
          videos: form.videos.filter((s) => s.trim() !== ""),
          files: form.files.filter((f) => f.name.trim() !== "" && f.url.trim() !== ""),
        });
        router.push("/admin/productos");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar.");
        setSaving(false);
      }
    });
  }

  const inputCls = "w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-4 py-3 text-white focus:border-[#E8231A] focus:outline-none transition-colors";
  const labelCls = "block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {/* Básicos */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-5">
        <h2 className="font-display font-bold text-base text-white">Datos básicos</h2>
        <div>
          <label className={labelCls}>Modelo *</label>
          <input className={inputCls} value={form.model} onChange={(e) => setField("model", e.target.value)} placeholder="Ej: A6 G2 Smart-POS" required />
        </div>
        <div>
          <label className={labelCls}>Categoría (subtitle de la tarjeta) *</label>
          <input className={inputCls} value={form.category} onChange={(e) => setField("category", e.target.value)} placeholder="Ej: Terminal Flagship" required />
        </div>
        <div>
          <label className={labelCls}>Sección</label>
          <select
            className={inputCls + " appearance-none"}
            value={form.section_id}
            onChange={(e) => handleSectionChange(e.target.value)}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Badge (opcional)</label>
          <input className={inputCls} value={form.badge} onChange={(e) => setField("badge", e.target.value)} placeholder="Ej: PREMIUM, FARMACIAS, IP54" />
        </div>
      </div>

      {/* Galería de imágenes */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
        <div className="mb-4">
          <h2 className="font-display font-bold text-base text-white">Imágenes del producto</h2>
          <p className="text-xs text-[#8A8A8A] mt-1">
            Hasta 5 fotos · La imagen 1 se muestra en la tarjeta y en el carrusel del modal de especificaciones.
          </p>
        </div>
        <ImageGalleryEditor
          images={form.images}
          onChange={(imgs) => setField("images", imgs)}
        />
        {/* URL legacy (solo si hay imagen previa sin galería) */}
        {form.images.length === 0 && form.image_url && (
          <div className="mt-4 pt-4 border-t border-[#2A2A2E]">
            <p className="text-xs text-[#8A8A8A] mb-2">
              Imagen actual (URL directa — subí fotos arriba para reemplazarla):
            </p>
            <div className="flex items-center gap-3">
              <img src={form.image_url} alt="Imagen actual" className="w-14 h-14 object-contain bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm p-1" />
              <code className="text-xs text-[#B0B0B0] flex-1 truncate">{form.image_url}</code>
            </div>
          </div>
        )}
      </div>

      {/* Videos */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-4">
        <div>
          <h2 className="font-display font-bold text-base text-white">Videos (máx. 2)</h2>
          <p className="text-xs text-[#8A8A8A] mt-1">URLs de videos del producto (YouTube, Vimeo, etc.).</p>
        </div>
        {form.videos.map((vid, i) => (
          <div key={i}>
            <label className={labelCls}>Video {i + 1}</label>
            <input
              className={inputCls}
              value={vid}
              onChange={(e) => setVideo(i, e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>
        ))}
      </div>

      {/* Descripción */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
        <h2 className="font-display font-bold text-base text-white mb-4">Descripción del producto</h2>
        <label className={labelCls}>Párrafo introductorio</label>
        <textarea
          className={inputCls + " min-h-[120px] resize-y"}
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="La terminal TITANIUM A6 tiene las características de una pantalla táctil capacitiva..."
        />
      </div>

      {/* Especificaciones completas */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
        <h2 className="font-display font-bold text-base text-white mb-1">Especificaciones técnicas completas</h2>
        <p className="text-xs text-[#8A8A8A] mb-4">
          Pegá el texto del catálogo. Las tablas en formato <code className="bg-[#0D0D0F] px-1 rounded">| Aspecto | Detalle |</code> se renderizan automáticamente en el modal.
        </p>
        <textarea
          className={inputCls + " min-h-[260px] resize-y font-mono text-sm"}
          value={form.full_specs}
          onChange={(e) => setField("full_specs", e.target.value)}
          placeholder={"| Aspecto | Detalle |\n|---|---|\n| CPU | Intel® Core™ i7-6500U @ 2.50GHz |\n| Memoria RAM | 16G DDR3 |\n| Disco Rígido | 256G SSD |"}
        />
      </div>

      {/* Archivos descargables */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-base text-white">Archivos descargables</h2>
            <p className="text-xs text-[#8A8A8A] mt-1">Drivers, folletos, manuales. El usuario los descarga desde el modal.</p>
          </div>
          <button
            type="button"
            onClick={addFile}
            className="px-4 py-2 text-xs font-display font-bold tracking-[0.1em] uppercase border border-[#E8231A]/40 text-[#E8231A] hover:bg-[#E8231A]/10 rounded-sm transition-colors"
          >
            + Agregar archivo
          </button>
        </div>

        {form.files.length === 0 && (
          <p className="text-xs text-[#8A8A8A] italic">Sin archivos. Hacé click en "+ Agregar archivo" para añadir uno.</p>
        )}

        {form.files.map((file, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
            <div>
              {i === 0 && <label className={labelCls}>Nombre</label>}
              <input
                className={inputCls}
                value={file.name}
                onChange={(e) => setFileField(i, "name", e.target.value)}
                placeholder="Driver Windows 10"
              />
            </div>
            <div>
              {i === 0 && <label className={labelCls}>URL o ruta</label>}
              <input
                className={inputCls}
                value={file.url}
                onChange={(e) => setFileField(i, "url", e.target.value)}
                placeholder="/files/driver-tk200.zip"
              />
            </div>
            <div>
              {i === 0 && <label className={labelCls}>Tipo</label>}
              <select
                className={inputCls + " appearance-none"}
                value={file.type}
                onChange={(e) => setFileField(i, "type", e.target.value)}
              >
                <option value="driver">Driver</option>
                <option value="folleto">Folleto</option>
                <option value="manual">Manual</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className={i === 0 ? "pt-6" : ""}>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="w-10 h-10 flex items-center justify-center text-[#8A8A8A] hover:text-[#E8231A] border border-[#2A2A2E] hover:border-[#E8231A]/40 rounded-sm transition-colors"
                title="Eliminar archivo"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Specs tarjeta */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-4">
        <h2 className="font-display font-bold text-base text-white">Especificaciones de la tarjeta (máx. 4)</h2>
        {form.specs.map((spec, i) => (
          <div key={i}>
            <label className={labelCls}>Spec {i + 1}</label>
            <input
              className={inputCls}
              value={spec}
              onChange={(e) => setSpec(i, e.target.value)}
              placeholder={`Característica ${i + 1}`}
            />
          </div>
        ))}
      </div>

      {/* Opciones */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-4">
        <h2 className="font-display font-bold text-base text-white">Opciones</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setField("active", !form.active)}
            className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? "bg-[#E8231A]" : "bg-[#2A2A2E]"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${form.active ? "translate-x-5" : "translate-x-0"}`} />
          </button>
          <span className="text-sm text-white font-display font-semibold">
            {form.active ? "Producto activo (visible en el sitio)" : "Producto oculto"}
          </span>
        </div>
        <div>
          <label className={labelCls}>Orden en el listado</label>
          <input
            type="number"
            className={inputCls + " w-32"}
            value={form.order_index}
            onChange={(e) => setField("order_index", Number(e.target.value))}
            min={0}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-[#E8231A] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-8 py-3 bg-[#E8231A] text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-[#C41D16] transition-colors disabled:opacity-50"
        >
          {saving ? "Guardando..." : product ? "Guardar cambios" : "Crear producto"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/productos")}
          className="px-6 py-3 text-sm font-display font-semibold text-[#8A8A8A] hover:text-white transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
