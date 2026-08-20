"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clientLabel, clientSubLabel } from "@/lib/types";
import { formatArPhone } from "@/lib/phone";
import { requeueClient, exportClients } from "@/app/admin/actions";
import type { ClientFilters } from "@/app/admin/actions";
import { openConversation } from "@/app/admin/outreach-actions";
import { downloadClientsCsv } from "@/lib/clients/csv";
import { ORIGIN_STYLE, TIER_LABEL, STATUS_LABEL } from "@/lib/clients/labels";
import ContactDots from "@/components/admin/ContactDots";
import ClientDrawer from "@/components/admin/ClientDrawer";
import type { CrmContact, ContactTier, PipelineStage } from "@/lib/types";

export default function ClientsTable({
  clients,
  tierCounts,
  filtered,
  canDelete,
  filters,
  stages,
  members,
  currentUserId,
  initialClientId,
}: {
  clients: CrmContact[];
  tierCounts: Record<ContactTier, number>;
  /** Si hay filtros activos, no se agrupa: la agrupación confundiría los conteos. */
  filtered: boolean;
  canDelete: boolean;
  /** Los mismos filtros que produjeron esta página, para exportar el conjunto completo. */
  filters: ClientFilters;
  stages: PipelineStage[];
  /** id de miembro → nombre, resuelto una sola vez arriba para no pedirlo por ítem. */
  members: Record<string, string>;
  currentUserId: string | null;
  /** `?cliente=<id>` de la carga inicial. Después la URL la maneja el cliente. */
  initialClientId: string | null;
}) {
  // El grupo 4 arranca colapsado: son los que no tienen nada y no se trabajan
  // hasta que el enriquecimiento termine.
  const [collapsed, setCollapsed] = useState<Set<ContactTier>>(new Set<ContactTier>([4]));
  const [openId, setOpenId] = useState<string | null>(initialClientId);
  const [exporting, setExporting] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  // Si fuimos nosotros los que apilamos una entrada de historial, cerrar es
  // "atrás". Si se entró por link directo no hay nada nuestro a lo que volver.
  const pushedRef = useRef(false);

  /**
   * La ficha NO pasa por el router de Next a propósito.
   *
   * Con `router.replace`, cada apertura y cada salto de cliente re-ejecutaría
   * el `Promise.all` de siete consultas de la página — incluida la de facetas,
   * que lee hasta 5.000 filas. Abrir una ficha no puede costar eso.
   *
   * `history.pushState` actualiza la URL y `useSearchParams` se entera, sin
   * re-renderizar el Server Component. Efecto secundario bueno: la barra de
   * filtros no se toca, así que su borrado de `page` nunca entra en juego.
   */
  function openClient(id: string) {
    const next = new URLSearchParams(window.location.search);
    next.set("cliente", id);
    if (openId) {
      // Saltar de cliente en cliente no debe apilar veinte entradas: "atrás"
      // tiene que volver a la lista, no al cliente anterior.
      window.history.replaceState(null, "", `?${next}`);
    } else {
      window.history.pushState(null, "", `?${next}`);
      pushedRef.current = true;
    }
    setOpenId(id);
  }

  function closeClient() {
    setOpenId(null);
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
      return;
    }
    const next = new URLSearchParams(window.location.search);
    next.delete("cliente");
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  // El "atrás" del navegador tiene que cerrar la ficha, no dejarla abierta con
  // la URL ya sin el parámetro.
  useEffect(() => {
    function onPop() {
      const id = new URLSearchParams(window.location.search).get("cliente");
      setOpenId(id);
      if (!id) pushedRef.current = false;
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openIndex = clients.findIndex((c) => c.id === openId);
  const openClientRow = openIndex >= 0 ? clients[openIndex] : null;

  // Se exporta todo lo que coincida con los filtros, no solo la página que se
  // ve: nadie quiere bajar 30 CSV de 50 filas para tener la lista completa.
  async function handleExport() {
    setExporting(true);
    try {
      downloadClientsCsv(await exportClients(filters));
    } catch {
      // Si el servidor falla, al menos se baja lo que ya está en pantalla.
      downloadClientsCsv(clients);
    } finally {
      setExporting(false);
    }
  }

  function toggle(tier: ContactTier) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }

  if (clients.length === 0) {
    return (
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-12 text-center text-[#8A8A8A]">
        {filtered ? "Ningún cliente coincide con estos filtros." : "Todavía no hay clientes cargados."}
      </div>
    );
  }

  // Los clientes vienen ya ordenados por prioridad desde la base, así que los
  // grupos son tramos contiguos: alcanza con detectar dónde cambia el tier.
  const rows: Array<{ kind: "header"; tier: ContactTier } | { kind: "row"; client: CrmContact }> = [];
  let lastTier: ContactTier | null = null;
  for (const client of clients) {
    if (!filtered && client.contact_tier !== lastTier) {
      rows.push({ kind: "header", tier: client.contact_tier });
      lastTier = client.contact_tier;
    }
    if (!filtered && collapsed.has(client.contact_tier)) continue;
    rows.push({ kind: "row", client });
  }

  return (
    <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#2A2A2E]">
        <p className="text-[11px] text-[#8A8A8A]">{clients.length} en esta página</p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-3 py-1.5 text-[11px] font-display font-semibold text-[#B0B0B0] hover:text-white bg-[#1A1A1E] hover:bg-[#2A2A2E] border border-[#2A2A2E] rounded-sm disabled:opacity-40 transition-colors"
          title="Descarga todos los clientes que coincidan con los filtros actuales, ordenados por prioridad de contacto"
        >
          {exporting ? "Preparando…" : "Exportar CSV"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2A2E]">
              <th className="text-left px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Cliente</th>
              <th className="text-left px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Origen</th>
              <th className="text-left px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Contacto</th>
              <th className="text-left px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] hidden md:table-cell">Localidad</th>
              <th className="text-left px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] hidden lg:table-cell">Google</th>
              <th className="text-right px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Enlaces</th>
              <th className="text-right px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, i) => {
              if (item.kind === "header") {
                const isCollapsed = collapsed.has(item.tier);
                return (
                  <tr key={`h-${item.tier}`} className="bg-[#0D0D0F] border-y border-[#2A2A2E]">
                    <td colSpan={7} className="px-5 py-2">
                      <button
                        onClick={() => toggle(item.tier)}
                        className="flex items-center gap-2 text-[11px] font-display font-bold tracking-[0.15em] uppercase text-[#B0B0B0] hover:text-white transition-colors"
                      >
                        <span className="text-[#8A8A8A]">{isCollapsed ? "▸" : "▾"}</span>
                        {item.tier} · {TIER_LABEL[item.tier]}
                        <span className="text-[#8A8A8A] font-normal tracking-normal normal-case">
                          ({tierCounts[item.tier]})
                        </span>
                        {item.tier === 4 && (
                          <span className="text-[#8A8A8A] font-normal tracking-normal normal-case">
                            — pendientes de revisar
                          </span>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              }

              const c = item.client;
              const origin = ORIGIN_STYLE[c.origin] ?? ORIGIN_STYLE.manual;
              const sub = clientSubLabel(c);
              const status = STATUS_LABEL[c.enrichment_status];

              return (
                <tr
                  key={c.id}
                  // La fila entera abre la ficha. Los enlaces y botones de
                  // adentro paran la propagación, así que copiar un mail no
                  // dispara también la apertura del panel.
                  onClick={() => openClient(c.id)}
                  className={`border-b border-[#2A2A2E] last:border-0 cursor-pointer transition-colors ${
                    c.id === openId ? "bg-[#1A1A1E]" : i % 2 === 0 ? "hover:bg-[#141416]" : "bg-[#1A1A1E]/30 hover:bg-[#141416]"
                  }`}
                >
                  <td className="px-5 py-3 max-w-[280px]">
                    <p className="text-white font-semibold truncate">{clientLabel(c)}</p>
                    <p className="text-[#8A8A8A] text-xs truncate">
                      {[c.rubro, sub].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </td>

                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-display font-bold tracking-wider uppercase border rounded-sm ${origin.className}`}
                    >
                      {origin.label}
                    </span>
                  </td>

                  <td className="px-5 py-3">
                    <ContactDots c={c} />
                    {status && (
                      <p className={`text-[10px] mt-1 ${status.className}`} title={c.enrichment_error ?? undefined}>
                        {status.text}
                      </p>
                    )}
                  </td>

                  <td className="px-5 py-3 text-[#B0B0B0] text-xs hidden md:table-cell">
                    {c.locality ?? "—"}
                  </td>

                  <td className="px-5 py-3 text-xs hidden lg:table-cell whitespace-nowrap">
                    {c.rating != null ? (
                      <span className="text-[#B0B0B0]">
                        ★ {c.rating}
                        {c.reviews_count != null && (
                          <span className="text-[#8A8A8A]"> ({c.reviews_count})</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[#8A8A8A]">—</span>
                    )}
                  </td>

                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2 text-xs">
                      {c.whatsapp_phone && (
                        <a
                          href={`https://wa.me/${c.whatsapp_phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Abrir WhatsApp con ${formatArPhone(c.whatsapp_phone)}`}
                          className="text-green-400 hover:text-green-300"
                        >
                          WhatsApp
                        </a>
                      )}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          title={c.email}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          Email
                        </a>
                      )}
                      {/* El teléfono también es accionable desde el celular, y
                          en la compu al menos permite copiarlo de un click. */}
                      {c.phone && (
                        <a
                          href={`tel:+${c.phone}`}
                          title={formatArPhone(c.phone)}
                          className="text-[#8A8A8A] hover:text-white"
                        >
                          Tel
                        </a>
                      )}
                      {c.website && (
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-[#8A8A8A] hover:text-white"
                        >
                          Sitio
                        </a>
                      )}
                      {/* Clave para el grupo 4: si no hay ningún dato de contacto,
                          el perfil de la red es lo único accionable que queda. */}
                      {c.instagram_url && (
                        <a
                          href={c.instagram_url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-[#8A8A8A] hover:text-white"
                        >
                          IG
                        </a>
                      )}
                      {c.facebook_url && (
                        <a
                          href={c.facebook_url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-[#8A8A8A] hover:text-white"
                        >
                          FB
                        </a>
                      )}
                      {c.google_maps_url && (
                        <a
                          href={c.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-[#8A8A8A] hover:text-white"
                        >
                          Maps
                        </a>
                      )}
                    </div>
                  </td>

                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2 text-[11px] whitespace-nowrap">
                      {c.manual_lock && (
                        <span
                          title="Cargado a mano — ningún proceso automático toca esta ficha"
                          className="text-[#8A8A8A]"
                        >
                          🔒
                        </span>
                      )}
                      {/* Todo el envío vive en la Bandeja: acá solo se abre la
                          conversación y se navega hasta el hilo. Es lo que evita
                          tener dos lugares desde donde mandar mensajes, con
                          reglas distintas. */}
                      {(c.whatsapp_phone || c.phone) && (
                        <button
                          onClick={() =>
                            startTransition(async () => {
                              const conversationId = await openConversation(c.id);
                              router.push(`/admin/inbox?c=${conversationId}`);
                            })
                          }
                          className="text-green-400 hover:text-green-300"
                        >
                          Escribir
                        </button>
                      )}
                      {/* Editar y eliminar viven en la ficha: son acciones que
                          piden ver el cliente entero, no una fila de siete
                          columnas. */}
                      {!c.manual_lock && c.enrichment_status !== "pending" && (
                        <button
                          onClick={() =>
                            startTransition(async () => {
                              await requeueClient(c.id);
                              router.refresh();
                            })
                          }
                          className="text-[#8A8A8A] hover:text-white"
                          title="Vuelve a ponerlo en la cola y reintenta desde cero"
                        >
                          Re-buscar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Fuera de la tabla a propósito: renderizar un panel dentro de <tbody>
          hace que el parser de HTML lo reubique y rompa la hidratación. */}
      <ClientDrawer
        client={openClientRow}
        stages={stages}
        members={members}
        currentUserId={currentUserId}
        canModerate={canDelete}
        onClose={closeClient}
        onPrev={openIndex > 0 ? () => openClient(clients[openIndex - 1].id) : undefined}
        onNext={
          openIndex >= 0 && openIndex < clients.length - 1
            ? () => openClient(clients[openIndex + 1].id)
            : undefined
        }
        position={openIndex >= 0 ? { index: openIndex, total: clients.length } : undefined}
      />
    </div>
  );
}
