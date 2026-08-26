"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clientLabel, clientSubLabel } from "@/lib/types";
import { requeueClient, exportClients } from "@/app/admin/actions";
import type { ClientFilters } from "@/app/admin/actions";
import { downloadClientsCsv } from "@/lib/clients/csv";
import { ORIGIN_STYLE, TIER_LABEL, STATUS_LABEL } from "@/lib/clients/labels";
import ContactDots from "@/components/admin/ContactDots";
import { IconResumen, IconActividad, IconDatos, IconRefresh, IconLock } from "@/components/admin/icons";
import ClientDrawer, { type Tab } from "@/components/admin/ClientDrawer";
import type { CrmContact, ContactTier, PipelineStage } from "@/lib/types";

/**
 * Cuánto contenido queda fuera de la vista a cada lado del scroll horizontal.
 *
 * La tabla mide ~1200 px dentro de un contenedor de ~740 px: 460 px ocultos,
 * sin barra visible, sin sombra y sin ninguna señal de que hubiera más
 * columnas. Un usuario nuevo concluía que la lista era de solo lectura.
 */
function useHorizontalOverflow() {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const hidden = el.scrollWidth - el.clientWidth;
      setEdges({
        left: el.scrollLeft > 4,
        right: hidden > 4 && el.scrollLeft < hidden - 4,
      });
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    // El ancho cambia al colapsar un grupo o al filtrar, no solo al
    // redimensionar la ventana.
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return { ref, ...edges };
}

/** Los tres atajos de la fila. En el mismo orden que las pestañas de la ficha. */
const ATAJOS = [
  { tab: "resumen" as const, label: "Resumen", Icon: IconResumen },
  { tab: "actividad" as const, label: "Actividad", Icon: IconActividad },
  { tab: "datos" as const, label: "Datos", Icon: IconDatos },
];

/**
 * Botón de acción de la fila, ya sin texto.
 *
 * Gris apagado en reposo y con color solo al pasar por encima: son acciones
 * secundarias que no tienen que competir con el nombre del cliente, que es lo
 * que uno viene a leer. El área de 28×28 alcanza para tocarlo en el teléfono.
 */
const ACCION_CLS =
  "inline-flex items-center justify-center p-1.5 rounded-sm text-[#8A8A8A] " +
  "hover:text-white hover:bg-[#2A2A2E] transition-colors";

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
  const scroll = useHorizontalOverflow();
  const [openId, setOpenId] = useState<string | null>(initialClientId);
  // La pestaña visible de la ficha vive acá y no adentro del panel: es lo que
  // hace que los atajos de la fila funcionen también sobre el cliente que ya
  // está abierto (mismo id, pestaña distinta).
  const [openTab, setOpenTab] = useState<Tab>("resumen");
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
  function openClient(id: string, tab: Tab = "resumen") {
    setOpenTab(tab);
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
        <p className="text-[13px] text-[#8A8A8A]">{clients.length} en esta página</p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-3 py-1.5 text-[13px] font-semibold text-[#B0B0B0] hover:text-white bg-[#1A1A1E] hover:bg-[#2A2A2E] border border-[#6A6A70] rounded-sm disabled:opacity-40 transition-colors"
          title="Descarga todos los clientes que coincidan con los filtros actuales, ordenados por prioridad de contacto"
        >
          {exporting ? "Preparando…" : "Exportar CSV"}
        </button>
      </div>
      {/* El contenedor lleva las dos señales de que hay más columnas: la sombra
          del borde derecho mientras quede contenido oculto, y la primera
          columna fija para que al scrollear no se pierda de vista a qué cliente
          pertenece la fila (era lo que dejaba "Eliminar" a un clic sin saber de
          quién). */}
      <div className="relative">
        {scroll.right && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-10 z-20 bg-gradient-to-l from-[#0D0D0F] to-transparent"
          />
        )}
        <div ref={scroll.ref} className="overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-[#2A2A2E]">
              <th className="text-left px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] sticky left-0 z-10 bg-[#141416]">Cliente</th>
              <th className="text-left px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Origen</th>
              <th className="text-left px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Contacto</th>
              <th className="text-left px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] hidden md:table-cell">Localidad</th>
              <th className="text-left px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] hidden lg:table-cell">Google</th>
              <th className="text-right px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, i) => {
              if (item.kind === "header") {
                const isCollapsed = collapsed.has(item.tier);
                return (
                  <tr key={`h-${item.tier}`} className="bg-[#0D0D0F] border-y border-[#2A2A2E]">
                    <td colSpan={6} className="px-5 py-2">
                      <button
                        onClick={() => toggle(item.tier)}
                        className="sticky left-0 flex items-center gap-2 text-[13px] font-bold tracking-[0.15em] uppercase text-[#B0B0B0] hover:text-white transition-colors"
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
                  className={`group border-b border-[#2A2A2E] last:border-0 cursor-pointer transition-colors ${
                    c.id === openId ? "bg-[#1A1A1E]" : i % 2 === 0 ? "hover:bg-[#141416]" : "bg-[#1A1A1E]/30 hover:bg-[#141416]"
                  }`}
                >
                  {/* Celda fija: necesita fondo OPACO propio, si no el
                      contenido de las otras columnas se le ve por debajo al
                      scrollear. Los valores replican el color efectivo de la
                      fila (la banda impar es #1A1A1E al 30% sobre #141416, que
                      compone #161618). */}
                  <td
                    className={`px-5 py-3 max-w-[280px] sticky left-0 z-10 transition-colors ${
                      c.id === openId
                        ? // La fila abierta no cambia con el hover, así que la
                          // celda fija tampoco: si no, se despareja del resto.
                          "bg-[#1A1A1E]"
                        : `group-hover:bg-[#141416] ${i % 2 === 0 ? "bg-[#141416]" : "bg-[#161618]"}`
                    }`}
                  >
                    <p className="text-white font-semibold truncate">{clientLabel(c)}</p>
                    <p className="text-[#8A8A8A] text-[13px] truncate">
                      {[c.rubro, sub].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </td>

                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 text-[12px] font-bold tracking-wider uppercase border rounded-sm ${origin.className}`}
                    >
                      {origin.label}
                    </span>
                  </td>

                  <td className="px-5 py-3">
                    <ContactDots c={c} />
                    {status && (
                      <p className={`text-[12px] mt-1 ${status.className}`} title={c.enrichment_error ?? undefined}>
                        {status.text}
                      </p>
                    )}
                  </td>

                  <td className="px-5 py-3 text-[#B0B0B0] text-[13px] hidden md:table-cell">
                    {c.locality ?? "—"}
                  </td>

                  <td className="px-5 py-3 text-[13px] hidden lg:table-cell whitespace-nowrap">
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
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      {c.manual_lock && (
                        <span
                          title="Cargado a mano — ningún proceso automático toca esta ficha"
                          aria-label="Ficha cargada a mano"
                          className="inline-flex items-center justify-center p-1.5 text-[#6E6E76]"
                        >
                          <IconLock />
                        </span>
                      )}
                      {/* Atajos a las tres pestañas de la ficha.
                          La fila entera ya abre el Resumen; estos llevan
                          directo a la pestaña que interesa sin pasar por ahí.
                          Reemplazan al viejo botón "Escribir": el camino a la
                          conversación interna sigue estando, en el Resumen
                          ("Abrir en la Bandeja"), y el chip de WhatsApp de la
                          columna CONTACTO abre wa.me directo. */}
                      {ATAJOS.map(({ tab, label, Icon }) => (
                        <button
                          key={tab}
                          onClick={() => openClient(c.id, tab)}
                          title={label}
                          aria-label={`${label} de ${clientLabel(c)}`}
                          className={ACCION_CLS}
                        >
                          <Icon />
                        </button>
                      ))}
                      {/* Editar y eliminar viven en la ficha: son acciones que
                          piden ver el cliente entero, no una fila de la tabla. */}
                      {!c.manual_lock && c.enrichment_status !== "pending" && (
                        <button
                          onClick={() =>
                            startTransition(async () => {
                              await requeueClient(c.id);
                              router.refresh();
                            })
                          }
                          title="Re-buscar — vuelve a ponerlo en la cola y reintenta desde cero"
                          aria-label={`Re-buscar datos de ${clientLabel(c)}`}
                          className={ACCION_CLS}
                        >
                          <IconRefresh />
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
      </div>

      {/* Fuera de la tabla a propósito: renderizar un panel dentro de <tbody>
          hace que el parser de HTML lo reubique y rompa la hidratación. */}
      <ClientDrawer
        client={openClientRow}
        stages={stages}
        members={members}
        currentUserId={currentUserId}
        canModerate={canDelete}
        tab={openTab}
        onTabChange={setOpenTab}
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
