"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertProduct } from "@/app/admin/actions";
import type { Product, ProductFile } from "@/lib/types";
import ImageGalleryEditor from "@/components/admin/ImageGalleryEditor";
import { useFormGuard } from "@/lib/hooks/useUnsavedChanges";
import { whyNotReady } from "@/lib/products/completeness";
import Toggle from "@/components/admin/Toggle";
import { useToast } from "@/components/admin/Toast";

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
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Texto de "qué le falta" cuando se intenta publicar algo incompleto.
  const [publishWarning, setPublishWarning] = useState<string | null>(null);

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
    // Un producto nuevo nace BORRADOR. Antes nacía activo y con orden 0, o sea
    // primero en el sitio, sin foto y sin datos — y nadie se enteraba.
    active: product?.active ?? false,
    order_index: product?.order_index ?? 0,
  });

  // Si el usuario deshace lo que tocó, el aviso también se apaga.
  const { dirty, markSaved } = useFormGuard(form, "Este producto tiene cambios sin guardar.");

  // Qué le falta para poder salir al sitio. Se recalcula solo cuando cambia
  // algo que cuenta, no en cada tecla del campo Modelo.
  const notReady = useMemo(
    () =>
      whyNotReady({
        images: form.images,
        image_url: form.image_url || null,
        description: form.description,
        full_specs: form.full_specs,
        specs: form.specs,
      }),
    [form.images, form.image_url, form.description, form.full_specs, form.specs]
  );

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

  /**
   * Guarda. `activeOverride` lo mandan los dos botones del alta ("borrador" y
   * "publicar"); en edición no se pasa y manda el toggle.
   *
   * Si se intenta publicar algo incompleto no se bloquea: se avisa qué falta y
   * se pide confirmación. El operador puede tener una razón, pero ahora la
   * decisión es explícita en vez de un default silencioso.
   */
  async function save(activeOverride?: boolean, force = false) {
    if (!form.model.trim()) { setError("El modelo es obligatorio."); return; }
    if (!form.category.trim()) { setError("La categoría es obligatoria."); return; }

    const willBeActive = activeOverride ?? form.active;
    if (willBeActive && notReady && !force) {
      setPublishWarning(notReady);
      return;
    }

    setError("");
    setPublishWarning(null);
    setSaving(true);
    startTransition(async () => {
      try {
        await upsertProduct({
          ...(product?.id ? { id: product.id } : {}),
          ...form,
          active: willBeActive,
          // Imagen de la tarjeta = primera de la galería (o la url existente como fallback)
          image_url: form.images[0] || form.image_url || null,
          specs: form.specs.filter((s) => s.trim() !== ""),
          images: form.images,
          videos: form.videos.filter((s) => s.trim() !== ""),
          files: form.files.filter((f) => f.name.trim() !== "" && f.url.trim() !== ""),
        });
        // Ya está guardado: que el guard no pregunte al navegar a la lista.
        markSaved({ ...form, active: willBeActive });
        toast.show(
          product ? "Cambios guardados" : willBeActive ? "Producto publicado" : "Borrador guardado",
          {
            detail: willBeActive
              ? ` ya se ve en el sitio.`
              : ` queda oculto hasta que lo publiques.`,
          }
        );
        router.push("/admin/productos");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar.");
        setSaving(false);
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // En el alta el submit por Enter guarda como borrador: es la opción que no
    // publica nada por accidente.
    save(product ? undefined : false);
  }

  function handleCancel() {
    if (dirty && !window.confirm("Tenés cambios sin guardar. ¿Descartarlos?")) return;
    markSaved();
    router.push("/admin/productos");
  }

  const inputCls = "w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-4 py-3 text-white focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none transition-colors";
  const labelCls = "block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="max-w-form space-y-6">
      {/* Básicos */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-5">
        <h2 className="font-display font-bold text-base text-white">Datos básicos</h2>
        <div>
          <label htmlFor="modelo" className={labelCls}>Modelo *</label>
          <input id="modelo" className={inputCls} value={form.model} onChange={(e) => setField("model", e.target.value)} placeholder="Ej: A6 G2 Smart-POS" required />
        </div>
        <div>
          <label htmlFor="categoria-subtitle-de-la-tar" className={labelCls}>Categoría (subtitle de la tarjeta) *</label>
          <input id="categoria-subtitle-de-la-tar" className={inputCls} value={form.category} onChange={(e) => setField("category", e.target.value)} placeholder="Ej: Terminal Flagship" required />
        </div>
        <div>
          <label htmlFor="seccion" className={labelCls}>Sección</label>
          <select id="seccion"
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
          <label htmlFor="badge-opcional" className={labelCls}>Badge (opcional)</label>
          <input id="badge-opcional" className={inputCls} value={form.badge} onChange={(e) => setField("badge", e.target.value)} placeholder="Ej: PREMIUM, FARMACIAS, IP54" />
        </div>
      </div>

      {/* Galería de imágenes */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
        <div className="mb-4">
          <h2 className="font-display font-bold text-base text-white">Imágenes del producto</h2>
          <p className="text-[13px] text-[#8A8A8A] mt-1">
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
            <p className="text-[13px] text-[#8A8A8A] mb-2">
              Imagen actual (URL directa — subí fotos arriba para reemplazarla):
            </p>
            <div className="flex items-center gap-3">
              <img src={form.image_url} alt="Imagen actual" className="w-14 h-14 object-contain bg-[#0D0D0F] border border-[#6A6A70] rounded-sm p-1" />
              <code className="text-[13px] text-[#B0B0B0] flex-1 truncate">{form.image_url}</code>
            </div>
          </div>
        )}
      </div>

      {/* Videos */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-4">
        <div>
          <h2 className="font-display font-bold text-base text-white">Videos (máx. 2)</h2>
          <p className="text-[13px] text-[#8A8A8A] mt-1">URLs de videos del producto (YouTube, Vimeo, etc.).</p>
        </div>
        {form.videos.map((vid, i) => (
          <div key={i}>
            <label htmlFor={`video-${i}`} className={labelCls}>Video {i + 1}</label>
            <input id={`video-${i}`}
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
        <label htmlFor="parrafo-introductorio" className={labelCls}>Párrafo introductorio</label>
        <textarea id="parrafo-introductorio"
          className={inputCls + " min-h-[120px] resize-y"}
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="La terminal TITANIUM A6 tiene las características de una pantalla táctil capacitiva..."
        />
      </div>

      {/* Especificaciones completas */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
        <h2 className="font-display font-bold text-base text-white mb-1">Especificaciones técnicas completas</h2>
        <p className="text-[13px] text-[#8A8A8A] mb-4">
          Pegá el texto del catálogo. Las tablas en formato <code className="bg-[#0D0D0F] px-1 rounded">| Aspecto | Detalle |</code> se renderizan automáticamente en el modal.
        </p>
        <textarea
          className={inputCls + " min-h-[260px] resize-y font-mono text-[15px]"}
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
            <p className="text-[13px] text-[#8A8A8A] mt-1">Drivers, folletos, manuales. El usuario los descarga desde el modal.</p>
          </div>
          <button
            type="button"
            onClick={addFile}
            className="px-4 py-2 text-xs font-display font-bold tracking-[0.1em] uppercase border border-[#E8231A]/40 text-[#FF6A5C] hover:bg-[#E8231A]/10 rounded-sm transition-colors"
          >
            + Agregar archivo
          </button>
        </div>

        {form.files.length === 0 && (
          <p className="text-[13px] text-[#8A8A8A] italic">Sin archivos. Hacé click en «+ Agregar archivo» para añadir uno.</p>
        )}

        {form.files.map((file, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
            <div>
              {i === 0 && <label htmlFor="archivo-nombre-0" className={labelCls}>Nombre</label>}
              <input id={`archivo-nombre-${i}`} aria-label={`Nombre del archivo ${i + 1}`}
                className={inputCls}
                value={file.name}
                onChange={(e) => setFileField(i, "name", e.target.value)}
                placeholder="Driver Windows 10"
              />
            </div>
            <div>
              {i === 0 && <label htmlFor="archivo-url-0" className={labelCls}>URL o ruta</label>}
              <input id={`archivo-url-${i}`} aria-label={`URL del archivo ${i + 1}`}
                className={inputCls}
                value={file.url}
                onChange={(e) => setFileField(i, "url", e.target.value)}
                placeholder="/files/driver-tk200.zip"
              />
            </div>
            <div>
              {i === 0 && <label htmlFor="archivo-tipo-0" className={labelCls}>Tipo</label>}
              <select id={`archivo-tipo-${i}`} aria-label={`Tipo del archivo ${i + 1}`}
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
                className="w-10 h-10 flex items-center justify-center text-[#8A8A8A] hover:text-[#FF6A5C] border border-[#2A2A2E] hover:border-[#E8231A]/40 rounded-sm transition-colors"
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
            <label htmlFor={`spec-${i}`} className={labelCls}>Spec {i + 1}</label>
            <input id={`spec-${i}`}
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
          <Toggle
            checked={form.active}
            onChange={(next) => setField("active", next)}
            label="Producto activo (visible en el sitio)"
          />
          <span className="text-[15px] text-white font-display font-semibold">
            {form.active ? "Producto activo (visible en el sitio)" : "Borrador (no se ve en el sitio)"}
          </span>
        </div>

        {/* Qué le falta. Informativo mientras está en borrador; el bloqueo real
            —la confirmación— aparece recién al intentar publicar. */}
        {notReady && (
          <p className="text-[13px] text-[#B0B0B0] bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-4 py-3">
            <span className="text-white font-semibold">Falta contenido:</span> {notReady}.{" "}
            {form.active
              ? "Así como está, la tarjeta sale incompleta en el sitio."
              : "Se puede publicar igual, pero conviene completarlo antes."}
          </p>
        )}

        <div>
          <label className={labelCls} htmlFor="product-order">Orden en el listado</label>
          <input
            id="product-order"
            type="number"
            className={inputCls + " w-32"}
            value={form.order_index}
            onChange={(e) => setField("order_index", Number(e.target.value))}
            min={0}
          />
        </div>
      </div>

      {error && (
        <p className="text-[15px] text-[#FF6A5C] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3">
          {error}
        </p>
      )}

      {/* Confirmación de publicación incompleta. No es un bloqueo: enumera lo
          que falta y deja seguir, que es lo que pide el hallazgo A3. */}
      {publishWarning && (
        <div className="bg-[#15150F] border border-[#3A3520] border-l-[3px] border-l-[#C9A227] rounded-sm px-4 py-4 space-y-3">
          <p className="text-[15px] text-[#E8E2CC]">
            <span className="font-semibold text-white">Este producto {publishWarning}.</span>{" "}
            Si lo publicás así, en el sitio va a aparecer una tarjeta incompleta.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => save(true, true)}
              className="px-5 py-2.5 bg-[#C41D16] text-white font-display font-bold text-xs tracking-widest uppercase rounded-sm hover:bg-[#E8231A] disabled:opacity-50 transition-colors"
            >
              Publicar igual
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => save(false, true)}
              className="px-5 py-2.5 border border-[#3A3520] text-[#E8E2CC] hover:text-white font-display font-bold text-xs tracking-widest uppercase rounded-sm disabled:opacity-50 transition-colors"
            >
              Guardar como borrador
            </button>
            <button
              type="button"
              onClick={() => setPublishWarning(null)}
              className="text-[13px] font-semibold text-[#8A8A8A] hover:text-white transition-colors"
            >
              Seguir editando
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {product ? (
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-[#C41D16] text-white font-display font-bold text-[15px] tracking-widest uppercase rounded-sm hover:bg-[#E8231A] transition-colors disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        ) : (
          <>
            {/* Dos salidas en el alta: el default no publica nada. El trade-off
                del clic extra se compensa con el botón de al lado. */}
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 border border-[#2A2A2E] text-white hover:border-[#3A3A3E] font-display font-bold text-[15px] tracking-widest uppercase rounded-sm transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar borrador"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => save(true)}
              className="px-8 py-3 bg-[#C41D16] text-white font-display font-bold text-[15px] tracking-widest uppercase rounded-sm hover:bg-[#E8231A] transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar y publicar"}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={handleCancel}
          className="px-6 py-3 text-[15px] font-display font-semibold text-[#8A8A8A] hover:text-white transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
