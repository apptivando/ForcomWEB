"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProductFile } from "@/lib/types";

interface Props {
  files: ProductFile[];
  onChange: (files: ProductFile[]) => void;
}

// Límite global de Storage en el plan de Supabase. Se chequea antes de subir
// para dar un mensaje claro en vez del error crudo del servidor.
const MAX_MB = 50;

// Antes el operador tenía que pegar una URL o ruta a mano, y no había dónde
// subir el archivo. Ahora se elige del disco y se sube al mismo bucket de las
// fotos, bajo `files/` (el bucket no restringe tipos ni tamaño).
function guessType(fileName: string): ProductFile["type"] {
  const n = fileName.toLowerCase();
  if (/\.(zip|rar|7z|exe|msi|apk|inf)$/.test(n) || n.includes("driver")) return "driver";
  if (n.includes("manual") || n.includes("guia") || n.includes("guía")) return "manual";
  if (n.includes("folleto") || n.includes("catalogo") || n.includes("catálogo") || n.includes("ficha")) return "folleto";
  return "otro";
}

function fileLabel(url: string) {
  const last = decodeURIComponent(url.split("?")[0].split("/").pop() ?? url);
  // Los subidos llevan `{timestamp}-` adelante: no le sirve a nadie verlo.
  return last.replace(/^\d{10,}-/, "");
}

export default function ProductFilesEditor({ files, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(list: FileList) {
    const selected = Array.from(list);
    const tooBig = selected.filter((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig.length) {
      setUploadError(
        `${tooBig.map((f) => f.name).join(", ")} pesa más de ${MAX_MB} MB. Comprimilo o subilo a otro lado (Drive, web del fabricante) y pedí que se cargue el link.`
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      const supabase = createClient();
      const added: ProductFile[] = [];

      for (const file of selected) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
        const base = file.name.replace(/\.[^.]+$/, "");
        const slug = base
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60);
        const path = `files/${Date.now()}-${slug}.${ext}`;

        const { error } = await supabase.storage
          .from("product-images")
          .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (error) throw error;

        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        added.push({ name: base, url: data.publicUrl, type: guessType(file.name) });
      }

      onChange([...files, ...added]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(`Error al subir: ${msg}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function setField(i: number, key: "name" | "type", val: string) {
    const next = [...files];
    next[i] = { ...next[i], [key]: val } as ProductFile;
    onChange(next);
  }

  function remove(i: number) {
    onChange(files.filter((_, idx) => idx !== i));
  }

  const inputCls = "w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-4 py-3 text-white focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none transition-colors";
  const labelCls = "block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5";

  return (
    <div className="space-y-4">
      {files.map((file, i) => (
        <div key={file.url + i} className="border border-[#2A2A2E] rounded-sm p-4 space-y-3">
          <div className="flex items-center gap-3 min-w-0">
            <svg className="w-5 h-5 shrink-0 text-[#8A8A8A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-[#B0B0B0] hover:text-white truncate flex-1"
              title="Abrir el archivo"
            >
              {fileLabel(file.url)}
            </a>
            <button
              type="button"
              onClick={() => remove(i)}
              className="w-9 h-9 shrink-0 flex items-center justify-center text-[#8A8A8A] hover:text-[#FF6A5C] border border-[#2A2A2E] hover:border-[#E8231A]/40 rounded-sm transition-colors"
              title="Quitar archivo"
              aria-label={`Quitar ${file.name || "archivo"}`}
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div>
              <label htmlFor={`archivo-nombre-${i}`} className={labelCls}>Nombre que ve el cliente</label>
              <input
                id={`archivo-nombre-${i}`}
                className={inputCls}
                value={file.name}
                onChange={(e) => setField(i, "name", e.target.value)}
                placeholder="Driver Windows 10"
              />
            </div>
            <div>
              <label htmlFor={`archivo-tipo-${i}`} className={labelCls}>Tipo</label>
              <select
                id={`archivo-tipo-${i}`}
                className={inputCls + " appearance-none"}
                value={file.type}
                onChange={(e) => setField(i, "type", e.target.value)}
              >
                <option value="driver">Driver</option>
                <option value="folleto">Folleto</option>
                <option value="manual">Manual</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full border-2 border-dashed border-[#2A2A2E] hover:border-[#E8231A]/50 hover:bg-[#E8231A]/5 rounded-sm py-8 flex flex-col items-center gap-2 text-[#8A8A8A] hover:text-white transition-colors disabled:opacity-60"
      >
        {uploading ? (
          <>
            <div className="w-6 h-6 border-2 border-[#2A2A2E] border-t-[#E8231A] rounded-full animate-spin" />
            <p className="text-[13px] font-display">Subiendo…</p>
          </>
        ) : (
          <>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-[15px] font-display font-semibold">
              {files.length ? "Subir otro archivo" : "Subir archivos"}
            </p>
            <p className="text-[13px]">PDF, ZIP, drivers… hasta {MAX_MB} MB cada uno</p>
          </>
        )}
      </button>

      {uploadError && (
        <p className="text-[13px] text-[#FF6A5C] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-3 py-2">
          {uploadError}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
        }}
      />
    </div>
  );
}
