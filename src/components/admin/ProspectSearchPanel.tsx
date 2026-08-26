"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchProspects, enrichNow } from "@/app/admin/actions";
import { INCLUDED_TYPES, MAX_RESULTS, PAGE_SIZE } from "@/lib/prospects/config";
import type { ProspectSearch } from "@/lib/types";

const inputClass =
  "bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-3 py-2 text-[15px] text-white placeholder:text-[#8A8A8A] focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none";

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

export default function ProspectSearchPanel({
  searches,
  queueCount,
  cseUsage,
  configured,
}: {
  searches: ProspectSearch[];
  queueCount: number;
  cseUsage: { used: number; limit: number };
  /** Si no hay API key ni modo de prueba, el formulario se muestra deshabilitado. */
  configured: boolean;
}) {
  const router = useRouter();

  /**
   * El historial mostraba "ferreterías · Córdoba Capital" dos veces seguidas
   * con el mismo conteo: no deduplicaba por criterio de búsqueda. Es cosmético,
   * pero contradice el mensaje de la sección, que explica con orgullo que los
   * resultados repetidos se fusionan solos.
   *
   * Se queda la más reciente de cada rubro+localidad — vienen ordenadas por
   * fecha descendente, así que alcanza con quedarse con la primera de cada par.
   */
  const busquedasUnicas = useMemo(() => {
    const vistas = new Set<string>();
    return searches.filter((s) => {
      const clave = `${s.rubro?.trim().toLowerCase()}|${s.locality?.trim().toLowerCase()}`;
      if (vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    });
  }, [searches]);
  const [open, setOpen] = useState(false);
  const [rubro, setRubro] = useState("");
  const [locality, setLocality] = useState("");
  const [includedType, setIncludedType] = useState("");
  const [maxResults, setMaxResults] = useState(MAX_RESULTS);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<string | null>(null);

  async function handleEnrich() {
    setEnriching(true);
    setEnrichResult(null);
    try {
      const r = await enrichNow();
      const parts = [
        `${r.processed} procesados`,
        r.email > 0 ? `${r.email} con email nuevo` : null,
        r.whatsapp > 0 ? `${r.whatsapp} con WhatsApp` : null,
        r.email === 0 && r.whatsapp === 0 ? "sin datos nuevos" : null,
        r.quotaExhausted ? "· se agotó la cuota de búsqueda de hoy" : null,
      ].filter(Boolean);
      setEnrichResult(parts.join(" · "));
      router.refresh();
    } catch (err) {
      setEnrichResult(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setEnriching(false);
    }
  }

  function handleSearch() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const r = await searchProspects({ rubro, locality, includedType, maxResults });
        const parts = [
          `${r.total} prospectos`,
          `${r.created} nuevos`,
          r.total - r.created > 0 ? `${r.total - r.created} ya existían` : null,
          r.skippedClosed > 0 ? `${r.skippedClosed} descartados por estar cerrados` : null,
        ].filter(Boolean);
        setResult(parts.join(" · "));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      }
    });
  }

  return (
    <div className="border-b border-[#2A2A2E] bg-[#141416]">
      <div className="flex items-center justify-between gap-4 px-8 py-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-xs font-display font-bold tracking-[0.15em] uppercase text-[#B0B0B0] hover:text-white transition-colors"
        >
          <span className="text-[#8A8A8A]">{open ? "▾" : "▸"}</span>
          Buscar prospectos
        </button>

        <div className="flex items-center gap-4 text-[13px] text-[#8A8A8A]">
          <span>
            Cola de enriquecimiento:{" "}
            <span className={queueCount > 0 ? "text-white" : ""}>{queueCount}</span>
          </span>
          <span title="Consultas a la API de búsqueda de Google usadas hoy (nivel 3)">
            Google Search hoy:{" "}
            <span className={cseUsage.used >= cseUsage.limit ? "text-[#FF6A5C]" : "text-white"}>
              {cseUsage.used}/{cseUsage.limit}
            </span>
          </span>
          {queueCount > 0 && (
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="px-3 py-1.5 text-[13px] font-semibold text-[#B0B0B0] hover:text-white bg-[#1A1A1E] hover:bg-[#2A2A2E] border border-[#6A6A70] rounded-sm disabled:opacity-40 transition-colors"
              title="Procesa un lote chico al instante. El resto lo hace el cron cada 5 minutos."
            >
              {enriching ? "Enriqueciendo…" : "Enriquecer ahora"}
            </button>
          )}
        </div>
      </div>

      {enrichResult && (
        <p className="px-8 pb-3 text-[13px] text-[#B0B0B0]">{enrichResult}</p>
      )}

      {open && (
        <div className="px-8 pb-5 space-y-3">
          {!configured && (
            <p className="text-[13px] text-[#FF6A5C] bg-[#E8231A]/5 border border-[#E8231A]/20 rounded-sm px-3 py-2">
              Falta cargar <code>GOOGLE_PLACES_API_KEY</code>. Para probar sin key, poné{" "}
              <code>GOOGLE_PLACES_MOCK=1</code> en <code>.env.local</code> y reiniciá{" "}
              <code>npm run dev</code>.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <input
              value={rubro}
              onChange={(e) => setRubro(e.target.value)}
              placeholder="Rubro — ej. ferreterías"
              className={`${inputClass} flex-1 min-w-[180px]`}
            />
            <input
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              placeholder="Localidad — ej. Córdoba Capital"
              className={`${inputClass} flex-1 min-w-[180px]`}
            />
            <select
              value={includedType}
              onChange={(e) => setIncludedType(e.target.value)}
              className={inputClass}
            >
              {INCLUDED_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className={inputClass}
              title="Cada 20 resultados es una llamada facturable a Google"
            >
              {[PAGE_SIZE, PAGE_SIZE * 2, MAX_RESULTS].map((n) => (
                <option key={n} value={n}>
                  Hasta {n}
                </option>
              ))}
            </select>
            <button
              onClick={handleSearch}
              disabled={pending || !rubro.trim() || !locality.trim()}
              className="px-6 py-2 bg-[#C41D16] text-white font-display font-bold text-xs tracking-widest uppercase rounded-sm hover:bg-[#E8231A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? "Buscando…" : "Buscar"}
            </button>
          </div>

          <p className="text-[13px] text-[#8A8A8A]">
            Google devuelve como máximo {MAX_RESULTS} resultados por búsqueda. Para cubrir una
            ciudad grande, conviene repetir por barrio — los repetidos se fusionan solos, no se
            duplican.
          </p>

          {error && (
            <p className="text-[13px] text-[#FF6A5C] bg-[#E8231A]/5 border border-[#E8231A]/20 rounded-sm px-3 py-2 whitespace-pre-line">
              {error}
            </p>
          )}
          {result && (
            <p className="text-[13px] text-green-400 bg-green-500/5 border border-green-500/20 rounded-sm px-3 py-2">
              {result}
            </p>
          )}

          {busquedasUnicas.length > 0 && (
            <div className="pt-1">
              <p className="text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5">
                Últimas búsquedas
              </p>
              <div className="flex flex-wrap gap-2">
                {busquedasUnicas.map((s) => (
                  <a
                    key={s.id}
                    href={`/admin/clientes?search=${s.id}`}
                    className="px-2.5 py-1 text-[13px] rounded-sm border border-[#2A2A2E] text-[#B0B0B0] hover:text-white hover:border-[#3A3A3E] transition-colors"
                    title={s.error ?? undefined}
                  >
                    {s.rubro} · {s.locality}{" "}
                    <span className={s.status === "error" ? "text-[#FF6A5C]" : "text-[#8A8A8A]"}>
                      ({s.status === "error" ? "falló" : s.results_count}) {timeAgo(s.created_at)}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
