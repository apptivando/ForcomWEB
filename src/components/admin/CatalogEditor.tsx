"use client";

import { useState, useTransition } from "react";
import { updateCatalogUrl } from "@/app/admin/catalog-actions";
import { parseCatalogUrl } from "@/lib/catalog";

// En main no existen Field ni useFormGuard (llegan con el panel rediseñado de
// develop): la etiqueta va a mano, como en CompanyInfoEditor de esta rama.
const labelCls =
  "block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5";

export default function CatalogEditor({ url }: { url: string | null }) {
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [value, setValue] = useState(url ?? "");

  // La vista previa se arma con lo que está escrito, antes de guardar: así se
  // ve si es el catálogo correcto sin tener que publicarlo.
  const preview = parseCatalogUrl(value);
  const invalid = value.trim() !== "" && !preview;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    startTransition(async () => {
      try {
        const stored = await updateCatalogUrl(value);
        setValue(stored ?? "");
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar.");
      } finally {
        setSaving(false);
      }
    });
  }

  const inputCls =
    "w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-4 py-3 text-white focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none transition-colors";

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
        <label className="block">
          <span className={labelCls}>Link del catálogo en Publuu</span>
          <input
            className={inputCls}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            placeholder="https://publuu.com/flip-book/216706/1518341"
          />
          <span className="block text-[13px] text-[#8A8A8A] mt-1.5">
            {invalid ? (
              <span className="text-[#FF6A5C]">
                No se reconoce como un catálogo de Publuu. Tiene que contener publuu.com/flip-book/…
              </span>
            ) : (
              <>
                Pegá el link que da Publuu al compartir el catálogo (también sirve el código de
                &quot;Embed&quot; entero). Si lo dejás vacío, el catálogo sale del sitio y del menú.
              </>
            )}
          </span>
        </label>
      </div>

      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">
            Vista previa
          </h3>
          {preview && (
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-[#FF6A5C] hover:text-white transition-colors"
            >
              Abrir en Publuu ↗
            </a>
          )}
        </div>
        {preview ? (
          <iframe
            key={preview.embedUrl}
            src={preview.embedUrl}
            title="Vista previa del catálogo"
            allow="clipboard-write; autoplay; fullscreen"
            allowFullScreen
            className="w-full h-[420px] bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm"
          />
        ) : (
          <p className="text-[15px] text-[#8A8A8A]">
            {value.trim() ? "Corregí el link para ver el catálogo." : "Sin catálogo: el ítem no aparece en el menú del sitio."}
          </p>
        )}
      </div>

      {error && (
        <p className="text-[15px] text-[#FF6A5C] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving || invalid}
          className="px-8 py-3 bg-[#C41D16] text-white font-display font-bold text-[15px] tracking-widest uppercase rounded-sm hover:bg-[#E8231A] transition-colors disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {saved && (
          <span className="text-[15px] text-green-400 font-display font-semibold">✓ Guardado</span>
        )}
      </div>
    </form>
  );
}
