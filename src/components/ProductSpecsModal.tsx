"use client";

import { useState, useEffect, useCallback } from "react";
import type { Product, ProductFile } from "@/lib/types";

interface Props {
  product: Product | null;
  onClose: () => void;
}

// ─── Markdown table parser ─────────────────────────────────────────────────────

type Block =
  | { kind: "table"; rows: string[][] }
  | { kind: "text"; lines: string[] };

function parseSpecsText(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) {
        const isseparator = /^\s*\|[\s\-|]+\|\s*$/.test(lines[i]);
        if (!isseparator) tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines.map((l) =>
        l
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim())
      );
      if (rows.length > 0) blocks.push({ kind: "table", rows });
    } else {
      const textLines: string[] = [];
      while (i < lines.length && !lines[i].trimStart().startsWith("|")) {
        textLines.push(lines[i]);
        i++;
      }
      const trimmed = textLines.join("\n").trim();
      if (trimmed) blocks.push({ kind: "text", lines: trimmed.split("\n") });
    }
  }

  return blocks;
}

// ─── File type label & icon ────────────────────────────────────────────────────

const FILE_TYPE_LABELS: Record<ProductFile["type"], string> = {
  driver: "Driver",
  folleto: "Folleto",
  manual: "Manual",
  otro: "Archivo",
};

function DownloadIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ProductSpecsModal({ product, onClose }: Props) {
  const [imgIndex, setImgIndex] = useState(0);
  const isOpen = product !== null;

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Reset carousel index when product changes
  useEffect(() => {
    setImgIndex(0);
  }, [product?.id]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  if (!product) return null;

  // Build image list: gallery images first, fallback to image_url
  const galleryImages = (product.images ?? []).filter(Boolean);
  const allImages = galleryImages.length > 0
    ? galleryImages
    : product.image_url
    ? [product.image_url]
    : [];

  const hasPrev = imgIndex > 0;
  const hasNext = imgIndex < allImages.length - 1;

  const specBlocks = product.full_specs ? parseSpecsText(product.full_specs) : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Especificaciones de ${product.model}`}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[620px] bg-[#141416] border-l border-[#2A2A2E] flex flex-col shadow-2xl"
        style={{ animation: "slide-in-right 0.28s cubic-bezier(0.22,1,0.36,1)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[#2A2A2E] shrink-0">
          <div>
            <p className="font-display font-semibold text-[10px] tracking-[0.2em] uppercase text-forcom-red mb-0.5">
              {product.category}
            </p>
            <h2 className="font-display font-bold text-xl tracking-tight text-white leading-tight">
              {product.model}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 w-9 h-9 flex items-center justify-center text-forcom-gray hover:text-white border border-[#2A2A2E] hover:border-[#444] rounded-sm transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Image carousel */}
          {allImages.length > 0 && (
            <div className="relative bg-[#0D0D0F] border-b border-[#2A2A2E]">
              <div className="aspect-[4/3] flex items-center justify-center overflow-hidden">
                <img
                  key={allImages[imgIndex]}
                  src={allImages[imgIndex]}
                  alt={`${product.model} — imagen ${imgIndex + 1}`}
                  className="w-full h-full object-contain p-6"
                />
              </div>

              {/* Arrows */}
              {allImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setImgIndex((n) => n - 1)}
                    disabled={!hasPrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-[#141416]/80 border border-[#2A2A2E] rounded-sm text-forcom-gray hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    aria-label="Imagen anterior"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImgIndex((n) => n + 1)}
                    disabled={!hasNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-[#141416]/80 border border-[#2A2A2E] rounded-sm text-forcom-gray hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    aria-label="Imagen siguiente"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}

              {/* Dots */}
              {allImages.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {allImages.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setImgIndex(idx)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        idx === imgIndex ? "bg-forcom-red w-4" : "bg-[#2A2A2E] hover:bg-[#555]"
                      }`}
                      aria-label={`Ver imagen ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="px-6 py-6 space-y-8">
            {/* Description */}
            {product.description && (
              <div>
                <h3 className="font-display font-bold text-sm tracking-[0.12em] uppercase text-forcom-gray mb-3">
                  Descripción
                </h3>
                <p className="text-sm text-[#B0B0B0] leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            {/* Full specs */}
            {specBlocks.length > 0 && (
              <div>
                <h3 className="font-display font-bold text-sm tracking-[0.12em] uppercase text-forcom-gray mb-4">
                  Especificaciones técnicas
                </h3>
                <div className="space-y-5">
                  {specBlocks.map((block, bi) => {
                    if (block.kind === "table") {
                      return (
                        <div key={bi} className="overflow-x-auto rounded-sm border border-[#2A2A2E]">
                          <table className="w-full text-sm border-collapse">
                            <tbody>
                              {block.rows.map((row, ri) => (
                                <tr key={ri} className="border-b border-[#2A2A2E] last:border-0 hover:bg-[#1A1A1E] transition-colors">
                                  {row.map((cell, ci) => (
                                    <td
                                      key={ci}
                                      className={`px-4 py-3 align-top ${
                                        ci === 0
                                          ? "text-forcom-gray font-display font-semibold text-xs tracking-wide whitespace-nowrap w-1/3"
                                          : "text-[#B0B0B0]"
                                      }`}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }
                    return (
                      <div key={bi} className="space-y-1">
                        {block.lines.map((line, li) => (
                          <p key={li} className="text-sm text-[#B0B0B0] leading-relaxed">
                            {line || <>&nbsp;</>}
                          </p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Videos */}
            {(product.videos ?? []).filter(Boolean).length > 0 && (
              <div>
                <h3 className="font-display font-bold text-sm tracking-[0.12em] uppercase text-forcom-gray mb-3">
                  Videos
                </h3>
                <div className="space-y-2">
                  {(product.videos ?? []).filter(Boolean).map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 bg-[#1A1A1E] border border-[#2A2A2E] rounded-sm text-sm text-[#B0B0B0] hover:text-white hover:border-[#444] transition-colors group"
                    >
                      <ExternalLinkIcon />
                      <span className="flex-1 truncate">{url}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Downloadable files */}
            {(product.files ?? []).filter((f) => f.name && f.url).length > 0 && (
              <div>
                <h3 className="font-display font-bold text-sm tracking-[0.12em] uppercase text-forcom-gray mb-3">
                  Archivos descargables
                </h3>
                <div className="space-y-2">
                  {(product.files ?? [])
                    .filter((f) => f.name && f.url)
                    .map((file, i) => (
                      <a
                        key={i}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="flex items-center gap-3 px-4 py-3 bg-[#1A1A1E] border border-[#2A2A2E] rounded-sm hover:border-forcom-red/40 hover:bg-forcom-red/5 transition-colors group"
                      >
                        <DownloadIcon />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-display font-semibold truncate">
                            {file.name}
                          </p>
                          <p className="text-[11px] text-forcom-gray">
                            {FILE_TYPE_LABELS[file.type] ?? "Archivo"}
                          </p>
                        </div>
                        <span className="text-[10px] font-display font-bold tracking-[0.12em] uppercase text-forcom-red opacity-0 group-hover:opacity-100 transition-opacity">
                          Descargar
                        </span>
                      </a>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
