"use client";

import { useState } from "react";

interface Props {
  images: string[];
  alt: string;
}

export default function ProductGallery({ images, alt }: Props) {
  const [imgIndex, setImgIndex] = useState(0);

  if (images.length === 0) return null;

  const hasPrev = imgIndex > 0;
  const hasNext = imgIndex < images.length - 1;

  return (
    <div className="relative bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm">
      <div className="aspect-[4/3] flex items-center justify-center overflow-hidden">
        <img
          key={images[imgIndex]}
          src={images[imgIndex]}
          alt={`${alt} — imagen ${imgIndex + 1}`}
          className="w-full h-full object-contain p-6"
        />
      </div>

      {/* Arrows */}
      {images.length > 1 && (
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
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, idx) => (
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
  );
}
