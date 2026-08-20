import Link from "next/link";
import {
  listClients,
  getClientTierCounts,
  getClientFacets,
  listProspectSearches,
  getEnrichmentQueueCount,
  getCseUsageToday,
} from "@/app/admin/actions";
import { placesConfigured } from "@/lib/prospects/places";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/roles";
import ClientsToolbar from "@/components/admin/ClientsToolbar";
import ClientsTable from "@/components/admin/ClientsTable";
import ProspectSearchPanel from "@/components/admin/ProspectSearchPanel";
import { CLIENTS_PAGE_SIZE } from "@/lib/types";
import type { ClientOrigin, ContactTier } from "@/lib/types";

// En Next 16 `searchParams` es una Promise y hay que await-earla.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
}

export default async function ClientesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  const tierParam = Number(one(sp.tier));
  const filters = {
    q: one(sp.q),
    origin: one(sp.origin) as ClientOrigin | undefined,
    tier: (tierParam >= 1 && tierParam <= 4 ? tierParam : undefined) as ContactTier | undefined,
    rubro: one(sp.rubro),
    locality: one(sp.locality),
    searchId: one(sp.search),
    page: Math.max(Number(one(sp.page) ?? 1) || 1, 1),
  };
  const isFiltered = Boolean(
    filters.q || filters.origin || filters.tier || filters.rubro || filters.locality || filters.searchId
  );

  const supabase = await createClient();
  const [{ clients, total }, tierCounts, facets, searches, queueCount, cseUsage, role] =
    await Promise.all([
      listClients(filters),
      getClientTierCounts(),
      getClientFacets(),
      listProspectSearches(6),
      getEnrichmentQueueCount(),
      getCseUsageToday(),
      getCurrentRole(supabase),
    ]);

  const totalAll = tierCounts[1] + tierCounts[2] + tierCounts[3] + tierCounts[4];
  const totalPages = Math.max(Math.ceil(total / CLIENTS_PAGE_SIZE), 1);
  const activeSearch = filters.searchId ? searches.find((s) => s.id === filters.searchId) : null;

  function pageHref(page: number) {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const s = one(v);
      if (s && k !== "page") next.set(k, s);
    }
    if (page > 1) next.set("page", String(page));
    const qs = next.toString();
    return qs ? `/admin/clientes?${qs}` : "/admin/clientes";
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-6 border-b border-[#2A2A2E]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">Clientes</h1>
            <p className="text-sm text-[#8A8A8A] mt-1">
              Todos los clientes, vengan de donde vengan. Ordenados por prioridad de contacto.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm text-white font-display font-semibold">
              {totalAll.toLocaleString("es-AR")} clientes
            </p>
            <p className="text-xs text-green-400">
              {tierCounts[1].toLocaleString("es-AR")} con WhatsApp
            </p>
          </div>
        </div>
      </div>

      <ProspectSearchPanel
        searches={searches}
        queueCount={queueCount}
        cseUsage={cseUsage}
        configured={placesConfigured()}
      />

      <ClientsToolbar
        rubros={facets.rubros}
        localities={facets.localities}
        searchLabel={activeSearch ? `${activeSearch.rubro} · ${activeSearch.locality}` : null}
      />

      <div className="flex-1 min-h-0 overflow-y-auto p-8">
        <ClientsTable
          clients={clients}
          tierCounts={tierCounts}
          filtered={isFiltered}
          canDelete={role === "owner" || role === "admin"}
          filters={filters}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs text-[#8A8A8A]">
            <span>
              {total.toLocaleString("es-AR")} resultados · página {filters.page} de {totalPages}
            </span>
            <div className="flex gap-2">
              {filters.page > 1 && (
                <Link
                  href={pageHref(filters.page - 1)}
                  className="px-3 py-1.5 border border-[#2A2A2E] rounded-sm hover:text-white hover:border-[#3A3A3E] transition-colors"
                >
                  Anterior
                </Link>
              )}
              {filters.page < totalPages && (
                <Link
                  href={pageHref(filters.page + 1)}
                  className="px-3 py-1.5 border border-[#2A2A2E] rounded-sm hover:text-white hover:border-[#3A3A3E] transition-colors"
                >
                  Siguiente
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Atribución exigida por los términos de Google Maps Platform al
            mostrar datos de Places sin un mapa, incluso puertas adentro. */}
        <p className="mt-6 text-[10px] text-[#8A8A8A]">
          Datos de establecimientos: Google Maps Platform.
        </p>
      </div>
    </div>
  );
}
