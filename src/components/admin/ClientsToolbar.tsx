"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import type { ContactTier } from "@/lib/types";

const ORIGINS = [
  { value: "busqueda", label: "Búsqueda" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "formulario", label: "Formulario" },
  { value: "manual", label: "Manual" },
];

const TIERS: { value: ContactTier; label: string }[] = [
  { value: 1, label: "1 · Con WhatsApp" },
  { value: 2, label: "2 · Con email" },
  { value: 3, label: "3 · Solo teléfono" },
  { value: 4, label: "4 · Sin contacto" },
];

const selectClass =
  "bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-2.5 py-2 text-[13px] text-white focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none";

/**
 * Filtros de /admin/clientes. Todo va a la querystring en vez de a estado de
 * cliente: así el filtrado lo hace el server (una sola consulta con `range`, no
 * traer la tabla entera al navegador), la vista filtrada se puede compartir por
 * link, y el botón "atrás" del navegador funciona como uno espera.
 */
export default function ClientsToolbar({
  rubros,
  localities,
  searchLabel,
}: {
  rubros: string[];
  localities: string[];
  /** Si se está viendo el resultado de una búsqueda puntual, su nombre. */
  searchLabel?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");

  // El texto libre se aplica con un respiro para no disparar una consulta por
  // cada tecla. El resto de los filtros son selectores: se aplican al instante.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const timer = setTimeout(() => apply("q", q), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function apply(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page"); // cualquier cambio de filtro vuelve a la primera página
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const activeFilters = ["origin", "tier", "rubro", "locality", "search", "q"].filter((k) =>
    params.get(k)
  );

  return (
    <div className="flex flex-wrap items-center gap-2 px-8 py-3 border-b border-[#2A2A2E] bg-[#141416]">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, email, teléfono…"
        className="flex-1 min-w-[200px] bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-3 py-2 text-[13px] text-white placeholder:text-[#8A8A8A] focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none"
      />

      <select
        value={params.get("origin") ?? ""}
        onChange={(e) => apply("origin", e.target.value)}
        className={selectClass}
      >
        <option value="">Todos los orígenes</option>
        {ORIGINS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={params.get("tier") ?? ""}
        onChange={(e) => apply("tier", e.target.value)}
        className={selectClass}
      >
        <option value="">Toda prioridad</option>
        {TIERS.map((t) => (
          <option key={t.value} value={String(t.value)}>
            {t.label}
          </option>
        ))}
      </select>

      {rubros.length > 0 && (
        <select
          value={params.get("rubro") ?? ""}
          onChange={(e) => apply("rubro", e.target.value)}
          className={selectClass}
        >
          <option value="">Todos los rubros</option>
          {rubros.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      )}

      {localities.length > 0 && (
        <select
          value={params.get("locality") ?? ""}
          onChange={(e) => apply("locality", e.target.value)}
          className={selectClass}
        >
          <option value="">Todas las localidades</option>
          {localities.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      )}

      {searchLabel && (
        <span className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] rounded-sm bg-[#E8231A]/10 text-[#FF6A5C] border border-[#E8231A]/20">
          Búsqueda: {searchLabel}
          <button onClick={() => apply("search", "")} className="hover:text-white" title="Quitar">
            ✕
          </button>
        </span>
      )}

      {activeFilters.length > 0 && (
        <button
          onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
          className="px-3 py-2 text-[13px] font-semibold text-[#8A8A8A] hover:text-white transition-colors"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
