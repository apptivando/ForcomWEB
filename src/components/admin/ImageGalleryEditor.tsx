"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export default function ImageGalleryEditor({ images, onChange, maxImages = 5 }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    const remaining = maxImages - images.length;
    if (remaining <= 0) return;
    const selected = Array.from(files).slice(0, remaining);
    setUploading(true);
    setUploadError("");

    try {
      const supabase = createClient();
      const newUrls: string[] = [];

      for (const file of selected) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const slug = file.name
          .replace(/\.[^.]+$/, "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .slice(0, 40);
        const path = `products/${Date.now()}-${slug}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("product-images")
          .upload(path, file, { upsert: false });

        if (uploadErr) throw uploadErr;

        const { data } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);

        newUrls.push(data.publicUrl);
      }

      onChange([...images, ...newUrls]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(`Error al subir: ${msg}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(i: number) {
    onChange(images.filter((_, idx) => idx !== i));
  }

  // ─── Drag-and-drop reorder ────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, i: number) {
    setDragIdx(i);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== i) setDragOverIdx(i);
  }

  function handleDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const next = [...images];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(targetIdx, 0, moved);
    onChange(next);
    setDragIdx(null);
    setDragOverIdx(null);
  }

  function handleDragEnd() {
    setDragIdx(null);
    setDragOverIdx(null);
  }

  const canAddMore = images.length < maxImages;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Empty state ── */}
      {images.length === 0 && !uploading && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-[#2A2A2E] hover:border-[#E8231A]/50 hover:bg-[#E8231A]/5 rounded-sm py-12 flex flex-col items-center gap-3 text-[#8A8A8A] hover:text-white transition-colors"
        >
          <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-display font-semibold">Subir imágenes</p>
            <p className="text-xs mt-0.5 text-[#8A8A8A]">Hasta {maxImages} fotos · JPG, PNG, WebP</p>
          </div>
        </button>
      )}

      {/* ── Uploading empty state ── */}
      {images.length === 0 && uploading && (
        <div className="w-full border border-[#2A2A2E] rounded-sm py-12 flex flex-col items-center gap-3 text-[#8A8A8A]">
          <div className="w-6 h-6 border-2 border-[#2A2A2E] border-t-[#E8231A] rounded-full animate-spin" />
          <p className="text-xs font-display">Subiendo…</p>
        </div>
      )}

      {/* ── Gallery grid ── */}
      {images.length > 0 && (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {images.map((url, i) => {
              const isDragging = dragIdx === i;
              const isTarget = dragOverIdx === i && dragIdx !== i;
              return (
                <div
                  key={url + i}
                  draggable
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                  className={[
                    "relative aspect-square rounded-sm border overflow-hidden transition-all select-none",
                    "cursor-grab active:cursor-grabbing",
                    isDragging ? "opacity-30 scale-95 border-[#E8231A]" : "",
                    isTarget ? "border-[#E8231A] ring-1 ring-[#E8231A]/50 scale-[1.03]" : "",
                    !isDragging && !isTarget ? "border-[#2A2A2E] hover:border-[#555]" : "",
                  ].join(" ")}
                >
                  <img
                    src={url}
                    alt={`Imagen ${i + 1}`}
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                  />

                  {/* Badge de orden */}
                  <span className="absolute top-1 left-1 min-w-[18px] h-[18px] flex items-center justify-center bg-black/75 text-white text-[10px] font-display font-bold rounded-sm px-1">
                    {i + 1}
                  </span>

                  {/* Botón eliminar */}
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-[18px] h-[18px] flex items-center justify-center bg-[#E8231A]/90 hover:bg-[#E8231A] text-white text-sm font-bold leading-none rounded-sm transition-colors"
                    title="Eliminar imagen"
                  >
                    ×
                  </button>

                  {/* Label "Principal" en la primera */}
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 right-1 text-center text-[8px] font-display font-bold tracking-wide uppercase bg-black/70 text-[#E8231A] rounded-sm py-0.5">
                      Principal
                    </span>
                  )}
                </div>
              );
            })}

            {/* Slot para agregar más */}
            {canAddMore && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square rounded-sm border-2 border-dashed border-[#2A2A2E] hover:border-[#E8231A]/50 hover:bg-[#E8231A]/5 flex flex-col items-center justify-center gap-1 text-[#8A8A8A] hover:text-[#E8231A] transition-colors disabled:opacity-40"
                title="Agregar imagen"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-[#2A2A2E] border-t-[#E8231A] rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-[9px] font-display font-bold tracking-wide uppercase">Agregar</span>
                  </>
                )}
              </button>
            )}
          </div>

          <p className="text-xs text-[#8A8A8A] mt-2.5">
            {images.length}/{maxImages} imágenes · Arrastrá para reordenar · Imagen 1 aparece en la tarjeta del producto
          </p>
        </>
      )}

      {/* Error */}
      {uploadError && (
        <p className="text-xs text-[#E8231A] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-3 py-2 mt-3">
          {uploadError}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
        }}
      />
    </div>
  );
}
