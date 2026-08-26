"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteProduct, toggleProductActive } from "@/app/admin/actions";
import type { Product } from "@/lib/types";
import { productGaps, placeholderFields } from "@/lib/products/completeness";
import { useToast } from "@/components/admin/Toast";

/**
 * Cuánto se espera antes de devolver la fila a la lista si el borrado NO se
 * confirmó.
 *
 * Tiene que ser mayor que la duración del aviso (7 s en `toast.undoable`): si
 * fueran iguales, los dos temporizadores compiten y la fila puede reaparecer
 * un instante antes de que el servidor confirme el borrado y revalide. Ese
 * medio segundo de más se lo lleva siempre el commit.
 */
const RESTAURAR_MS = 7500;

export default function ProductsTable({ products }: { products: Product[] }) {
  const [, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const toast = useToast();
  // Filas que el usuario ya mandó a borrar pero todavía puede deshacer. Se
  // ocultan de la tabla al instante; el borrado real sale cuando expira el
  // aviso. Ver `undoable` en Toast.tsx.
  const [borrandose, setBorrandose] = useState<Set<string>>(new Set());
  // Buscador y filtro. Con 18 filas y sin buscador había que leer la lista
  // entera para encontrar la EasyLabel; el catálogo va a crecer.
  const [q, setQ] = useState("");
  const [soloIncompletos, setSoloIncompletos] = useState(false);

  function handleToggle(id: string, current: boolean) {
    startTransition(() => toggleProductActive(id, !current));
  }

  function handleDelete(p: Product) {
    setConfirmDelete(null);
    setBorrandose((prev) => new Set(prev).add(p.id));

    toast.undoable(
      "Producto eliminado",
      () => {
        // Se confirmó: recién acá va al servidor.
        startTransition(() => deleteProduct(p.id));
      },
      { detail: p.model }
    );

    // Si el usuario deshace, el producto tiene que volver a la lista. El toast
    // no avisa "me deshicieron", así que se revierte cuando pasa la ventana:
    // si el borrado se confirmó, `deleteProduct` revalida y la fila no vuelve.
    setTimeout(() => {
      setBorrandose((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }, RESTAURAR_MS);
  }

  const termino = q.trim().toLowerCase();
  const visibles = products
    .filter((p) => !borrandose.has(p.id))
    .filter((p) => {
      if (soloIncompletos && productGaps(p).length === 0 && placeholderFields(p).length === 0) {
        return false;
      }
      if (!termino) return true;
      return [p.model, p.category, p.section, p.badge]
        .filter(Boolean)
        .some((campo) => campo!.toLowerCase().includes(termino));
    });

  const incompletos = products.filter(
    (p) => productGaps(p).length > 0 || placeholderFields(p).length > 0
  ).length;

  if (products.length === 0) {
    return (
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-12 text-center text-[#8A8A8A]">
        No hay productos cargados aún.
      </div>
    );
  }

  return (
    <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm overflow-hidden">
      {/* Buscador y filtro de completitud */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-[#2A2A2E]">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por modelo, categoría o sección…"
          aria-label="Buscar productos"
          className="flex-1 min-w-[220px] bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-3 py-2 text-[15px] text-white placeholder:text-[#6E6E76] focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none"
        />
        {incompletos > 0 && (
          <button
            type="button"
            onClick={() => setSoloIncompletos((v) => !v)}
            aria-pressed={soloIncompletos}
            className={`px-3 py-2 text-[13px] font-semibold rounded-sm border transition-colors ${
              soloIncompletos
                ? "bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/40"
                : "bg-[#1A1A1E] text-[#B0B0B0] border-[#6A6A70] hover:text-white"
            }`}
          >
            Solo incompletos ({incompletos})
          </button>
        )}
        <span className="text-[13px] text-[#8A8A8A] tabular-nums">
          {visibles.length} de {products.length}
        </span>
      </div>

      {visibles.length === 0 ? (
        <p className="p-12 text-center text-[#8A8A8A]">
          Ningún producto coincide con la búsqueda.
        </p>
      ) : (
      <table className="w-full text-[15px]">
        <thead>
          <tr className="border-b border-[#2A2A2E]">
            <th className="text-left px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Modelo</th>
            <th className="text-left px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] hidden md:table-cell">Sección</th>
            <th className="text-left px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] hidden lg:table-cell">Badge</th>
            <th className="text-left px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Estado</th>
            <th className="text-right px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] w-[240px]">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((p, i) => {
            // "Sin imágenes" / "Sin specs" en la fila: hasta ahora nada
            // distinguía un producto completo de uno a medio cargar, y el
            // listado era el único lugar donde se podía ver de un vistazo.
            const gaps = productGaps(p);
            const placeholders = placeholderFields(p);
            return (
            <tr key={p.id} className={`border-b border-[#2A2A2E] last:border-0 ${i % 2 === 0 ? "" : "bg-[#1A1A1E]/30"}`}>
              <td className="px-5 py-3">
                <div className="flex items-start gap-3">
                  {/* Miniatura: para saber cuál es la EasyLabel había que
                      abrirla. Hero ya mostraba miniaturas — el patrón bueno
                      existía en el panel, solo faltaba aplicarlo acá. */}
                  <div className="w-10 h-10 shrink-0 bg-[#0D0D0F] border border-[#6A6A70] rounded-sm overflow-hidden flex items-center justify-center">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt=""
                        className="w-full h-full object-contain p-0.5"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-[#3A3A3E] text-lg leading-none">—</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold">{p.model}</p>
                    <p className="text-[#8A8A8A] text-[13px]">{p.category}</p>
                    {(gaps.length > 0 || placeholders.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {gaps.map((g) => (
                          <span
                            key={g}
                            className="px-1.5 py-0.5 text-[12px] font-semibold rounded-sm border border-dashed border-[#3A3A3E] text-[#8A8A8A]"
                          >
                            Sin {g}
                          </span>
                        ))}
                        {placeholders.length > 0 && (
                          <span
                            title={`Quedó texto a completar en ${placeholders.join(", ")}`}
                            className="px-1.5 py-0.5 text-[12px] font-semibold rounded-sm border border-[#C9A227]/40 bg-[#C9A227]/10 text-[#C9A227]"
                          >
                            Texto a completar
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-5 py-3 text-[#B0B0B0] text-[13px] hidden md:table-cell">{p.section}</td>
              <td className="px-5 py-3 hidden lg:table-cell">
                {p.badge ? (
                  <span className="px-2 py-0.5 text-[12px] font-bold tracking-wider uppercase bg-[#E8231A]/10 text-[#FF6A5C] border border-[#E8231A]/20 rounded-sm">
                    {p.badge}
                  </span>
                ) : (
                  <span className="text-[#8A8A8A]">—</span>
                )}
              </td>
              <td className="px-5 py-3">
                <button
                  onClick={() => handleToggle(p.id, p.active)}
                  className={`px-2.5 py-1 text-[12px] font-bold tracking-wider uppercase rounded-sm border transition-colors ${
                    p.active
                      ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                      : "bg-[#2A2A2E] text-[#8A8A8A] border-[#2A2A2E] hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20"
                  }`}
                >
                  {p.active ? "Activo" : "Borrador"}
                </button>
              </td>
              {/* Ancho fijo: sin esto, al aparecer "Confirmar/Cancelar" la celda
                  crece y se reacomodan TODAS las columnas de la tabla. */}
              <td className="px-5 py-3 text-right w-[240px]">
                <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                  <Link
                    href={`/admin/productos/${p.id}`}
                    className="px-3 py-1.5 text-[13px] font-semibold text-[#B0B0B0] hover:text-white bg-[#1A1A1E] hover:bg-[#2A2A2E] border border-[#6A6A70] rounded-sm transition-colors"
                  >
                    Editar
                  </Link>
                  {confirmDelete === p.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(p)}
                        className="px-3 py-1.5 text-[13px] font-semibold text-white bg-[#C41D16] hover:bg-[#E8231A] rounded-sm transition-colors"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-3 py-1.5 text-[13px] font-semibold text-[#8A8A8A] hover:text-white rounded-sm transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(p.id)}
                      className="px-3 py-1.5 text-[13px] font-semibold text-[#8A8A8A] hover:text-[#FF6A5C] hover:bg-[#E8231A]/5 border border-transparent hover:border-[#E8231A]/20 rounded-sm transition-colors"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      )}
    </div>
  );
}
