"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteProduct, toggleProductActive } from "@/app/admin/actions";
import type { Product } from "@/lib/types";

export default function ProductsTable({ products }: { products: Product[] }) {
  const [, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function handleToggle(id: string, current: boolean) {
    startTransition(() => toggleProductActive(id, !current));
  }

  function handleDelete(id: string) {
    startTransition(() => {
      deleteProduct(id);
      setConfirmDelete(null);
    });
  }

  if (products.length === 0) {
    return (
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-12 text-center text-[#8A8A8A]">
        No hay productos cargados aún.
      </div>
    );
  }

  return (
    <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2A2A2E]">
            <th className="text-left px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Modelo</th>
            <th className="text-left px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] hidden md:table-cell">Sección</th>
            <th className="text-left px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] hidden lg:table-cell">Badge</th>
            <th className="text-left px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Estado</th>
            <th className="text-right px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => (
            <tr key={p.id} className={`border-b border-[#2A2A2E] last:border-0 ${i % 2 === 0 ? "" : "bg-[#1A1A1E]/30"}`}>
              <td className="px-5 py-3">
                <p className="text-white font-semibold">{p.model}</p>
                <p className="text-[#8A8A8A] text-xs">{p.category}</p>
              </td>
              <td className="px-5 py-3 text-[#B0B0B0] text-xs hidden md:table-cell">{p.section}</td>
              <td className="px-5 py-3 hidden lg:table-cell">
                {p.badge ? (
                  <span className="px-2 py-0.5 text-[10px] font-display font-bold tracking-wider uppercase bg-[#E8231A]/10 text-[#E8231A] border border-[#E8231A]/20 rounded-sm">
                    {p.badge}
                  </span>
                ) : (
                  <span className="text-[#8A8A8A]">—</span>
                )}
              </td>
              <td className="px-5 py-3">
                <button
                  onClick={() => handleToggle(p.id, p.active)}
                  className={`px-2.5 py-1 text-[10px] font-display font-bold tracking-wider uppercase rounded-sm border transition-colors ${
                    p.active
                      ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                      : "bg-[#2A2A2E] text-[#8A8A8A] border-[#2A2A2E] hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20"
                  }`}
                >
                  {p.active ? "Activo" : "Oculto"}
                </button>
              </td>
              <td className="px-5 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/admin/productos/${p.id}`}
                    className="px-3 py-1.5 text-xs font-display font-semibold text-[#B0B0B0] hover:text-white bg-[#1A1A1E] hover:bg-[#2A2A2E] border border-[#2A2A2E] rounded-sm transition-colors"
                  >
                    Editar
                  </Link>
                  {confirmDelete === p.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="px-3 py-1.5 text-xs font-display font-semibold text-white bg-[#E8231A] hover:bg-[#C41D16] rounded-sm transition-colors"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-3 py-1.5 text-xs font-display font-semibold text-[#8A8A8A] hover:text-white rounded-sm transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(p.id)}
                      className="px-3 py-1.5 text-xs font-display font-semibold text-[#8A8A8A] hover:text-[#E8231A] hover:bg-[#E8231A]/5 border border-transparent hover:border-[#E8231A]/20 rounded-sm transition-colors"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
