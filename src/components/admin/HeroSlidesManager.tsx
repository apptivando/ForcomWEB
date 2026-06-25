"use client";

import { useState } from "react";
import type { HeroSlide } from "@/lib/types";
import {
  deleteHeroSlide,
  toggleHeroSlideActive,
  reorderHeroSlides,
} from "@/app/admin/actions";
import HeroSlideForm from "./HeroSlideForm";

export default function HeroSlidesManager({ initial }: { initial: HeroSlide[] }) {
  const [slides, setSlides] = useState<HeroSlide[]>(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HeroSlide | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  function handleDragStart(i: number) {
    setDragIdx(i);
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    setOverIdx(i);
  }

  async function handleDrop(i: number) {
    if (dragIdx === null || dragIdx === i) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const reordered = [...slides];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(i, 0, moved);
    const indexed = reordered.map((s, idx) => ({ ...s, order_index: idx }));
    setSlides(indexed);
    setDragIdx(null);
    setOverIdx(null);
    try {
      await reorderHeroSlides(indexed.map((s) => ({ id: s.id, order_index: s.order_index })));
    } catch {
      setError("Error al guardar el nuevo orden.");
    }
  }

  function handleDragEnd() {
    setDragIdx(null);
    setOverIdx(null);
  }

  // ── Toggle activo ──────────────────────────────────────────────────────────

  async function handleToggle(slide: HeroSlide) {
    setBusyId(slide.id);
    try {
      await toggleHeroSlideActive(slide.id, !slide.active);
      setSlides((prev) =>
        prev.map((s) => (s.id === slide.id ? { ...s, active: !s.active } : s))
      );
    } catch {
      setError("Error al cambiar el estado.");
    } finally {
      setBusyId(null);
    }
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────

  async function handleDelete(slide: HeroSlide) {
    if (!window.confirm(`¿Eliminar el slide "${slide.badge_text}"? Esta acción no se puede deshacer.`)) return;
    setBusyId(slide.id);
    try {
      await deleteHeroSlide(slide.id);
      setSlides((prev) => prev.filter((s) => s.id !== slide.id));
    } catch {
      setError("Error al eliminar el slide.");
    } finally {
      setBusyId(null);
    }
  }

  // ── Guardar (create / update) desde el form ────────────────────────────────

  function handleSaved(saved: HeroSlide) {
    setSlides((prev) => {
      const exists = prev.find((s) => s.id === saved.id);
      if (exists) return prev.map((s) => (s.id === saved.id ? saved : s));
      return [...prev, saved];
    });
  }

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(slide: HeroSlide) {
    setEditTarget(slide);
    setFormOpen(true);
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-[#8A8A8A]">
          Arrastrá las filas para reordenar · {slides.filter((s) => s.active).length} de {slides.length} activos
        </p>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E8231A] text-white font-display font-bold text-sm tracking-wider uppercase rounded-sm hover:bg-[#C41D16] transition-colors"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo slide
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-[#E8231A]/10 border border-[#E8231A]/30 rounded-sm text-sm text-[#E8231A] flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-[#E8231A] hover:text-white">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Slide list */}
      {slides.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3 text-center border border-dashed border-[#2A2A2E] rounded-sm">
          <svg className="w-10 h-10 text-[#2A2A2E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <p className="text-[#8A8A8A] text-sm">No hay slides. Creá el primero.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-4 p-4 bg-[#141416] border rounded-sm transition-all select-none ${
                dragIdx === i
                  ? "opacity-40 border-[#2A2A2E]"
                  : overIdx === i && dragIdx !== null
                  ? "border-[#E8231A] bg-[#E8231A]/5"
                  : "border-[#2A2A2E]"
              }`}
            >
              {/* Drag handle */}
              <div className="cursor-grab active:cursor-grabbing text-[#2A2A2E] hover:text-[#8A8A8A] transition-colors flex-shrink-0">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM16 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM16 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                </svg>
              </div>

              {/* Thumbnail */}
              <div className="w-16 h-12 flex-shrink-0 bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm overflow-hidden flex items-center justify-center">
                {slide.image_url ? (
                  <img src={slide.image_url} alt={slide.image_alt} className="w-full h-full object-contain p-1" />
                ) : (
                  <svg className="w-5 h-5 text-[#2A2A2E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                  </svg>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-sm text-white truncate">
                  {slide.headline_line1} {slide.headline_line2}{" "}
                  <span className="text-[#E8231A]">{slide.headline_accent}</span>
                </p>
                <p className="text-xs text-[#8A8A8A] truncate mt-0.5">{slide.badge_text}</p>
              </div>

              {/* Order index badge */}
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-[#0D0D0F] text-[#8A8A8A] text-xs font-display font-bold border border-[#2A2A2E]">
                {i + 1}
              </span>

              {/* Active toggle */}
              <button
                type="button"
                disabled={busyId === slide.id}
                onClick={() => handleToggle(slide)}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8231A] ${
                  slide.active ? "bg-[#E8231A]" : "bg-[#2A2A2E]"
                }`}
                title={slide.active ? "Activo — click para desactivar" : "Inactivo — click para activar"}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    slide.active ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>

              {/* Edit */}
              <button
                type="button"
                onClick={() => openEdit(slide)}
                className="flex-shrink-0 p-2 text-[#8A8A8A] hover:text-white hover:bg-[#1A1A1E] rounded-sm transition-colors"
                title="Editar slide"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>

              {/* Delete */}
              <button
                type="button"
                disabled={busyId === slide.id}
                onClick={() => handleDelete(slide)}
                className="flex-shrink-0 p-2 text-[#8A8A8A] hover:text-[#E8231A] hover:bg-[#E8231A]/10 rounded-sm transition-colors disabled:opacity-50"
                title="Eliminar slide"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {formOpen && (
        <HeroSlideForm
          slide={editTarget}
          slideCount={slides.length}
          onSave={handleSaved}
          onClose={() => { setFormOpen(false); setEditTarget(null); }}
        />
      )}
    </div>
  );
}
