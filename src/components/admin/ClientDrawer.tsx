"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Drawer from "@/components/admin/Drawer";
import ContactDots from "@/components/admin/ContactDots";
import ClientTimeline from "@/components/admin/ClientTimeline";
import ClientDataForm from "@/components/admin/ClientDataForm";
import ClientDeals from "@/components/admin/ClientDeals";
import { ORIGIN_STYLE, TIER_LABEL, ENRICHMENT_LEVEL_LABEL, WHATSAPP_SOURCE_LABEL } from "@/lib/clients/labels";
import { formatArPhone } from "@/lib/phone";
import { clientLabel } from "@/lib/types";
import { openConversation } from "@/app/admin/outreach-actions";
import { getClient } from "@/app/admin/client-actions";
import type { CrmContact, PipelineStage } from "@/lib/types";

export type Tab = "resumen" | "actividad" | "datos";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Una fila del bloque de datos. Muestra "—" en vez de esconder lo vacío: que
 *  un campo esté en blanco es información, y esconderlo lo disimula. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 border-b border-[#1F1F23] last:border-0">
      <span className="w-32 shrink-0 text-[13px] text-[#8A8A8A] pt-0.5">{label}</span>
      <div className="flex-1 min-w-0 text-[13px] text-[#B0B0B0] break-words">{children}</div>
    </div>
  );
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-[#B0B0B0] hover:text-white underline underline-offset-4 decoration-[#2A2A2E]"
    >
      {children}
    </a>
  );
}

export default function ClientDrawer({
  client,
  stages,
  members,
  currentUserId,
  canModerate,
  onClose,
  onPrev,
  onNext,
  position,
  tab,
  onTabChange,
}: {
  client: CrmContact | null;
  stages: PipelineStage[];
  members: Record<string, string>;
  currentUserId: string | null;
  canModerate: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** "3 de 50" — para saber dónde estás sin cerrar la ficha. */
  position?: { index: number; total: number };
  /**
   * La pestaña visible la maneja el PADRE, no la ficha.
   *
   * Es lo que permite que los atajos de la fila (Resumen · Actividad · Datos)
   * funcionen también sobre el cliente que ya está abierto: si el estado
   * viviera acá, pedir otra pestaña del mismo cliente no cambiaría el `id` y
   * no habría nada que disparara el cambio.
   */
  tab: Tab;
  onTabChange: (t: Tab) => void;
}) {
  const [shownId, setShownId] = useState(client?.id ?? null);
  /**
   * La ficha es dueña de su copia del cliente.
   *
   * Antes se leía directo de la prop, y eso la ataba a que el servidor
   * re-renderizara la lista: después de guardar, el panel seguía mostrando la
   * versión vieja —por ejemplo sin el candado recién puesto— hasta recargar. Y
   * cada refresco del servidor era una oportunidad de que el panel se
   * reiniciara y perdieras la pestaña en la que estabas.
   *
   * Ahora se sincroniza solo cuando cambia el cliente, y después de cada
   * acción propia se relee con `getClient`.
   */
  const [current, setCurrent] = useState(client);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Ajuste durante el render, no en un efecto. La pestaña la resetea el padre
  // al abrir otro cliente: quedarse en "Datos" con el formulario de otro
  // cliente a medio llenar es la peor sorpresa posible.
  if (client && client.id !== shownId) {
    setShownId(client.id);
    setCurrent(client);
  }

  // Al cerrar, `client` pasa a null pero se conserva el último para que el
  // contenido no desaparezca de golpe mientras el panel se desliza afuera.
  const shown = current;
  if (!shown) return null;

  async function refreshCurrent() {
    if (!shown) return;
    try {
      setCurrent(await getClient(shown.id));
    } catch {
      // Si falla, se queda con lo que tenía: peor sería vaciar la ficha.
    }
  }

  const origin = ORIGIN_STYLE[shown.origin] ?? ORIGIN_STYLE.manual;
  const tabs: Array<[Tab, string]> = [
    ["resumen", "Resumen"],
    ["actividad", "Actividad"],
    ["datos", "Datos"],
  ];

  return (
    <Drawer
      open={Boolean(client)}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 flex-wrap">
          <span>{clientLabel(shown)}</span>
          <span
            className={`px-2 py-0.5 text-[12px] font-bold tracking-wider uppercase border rounded-sm ${origin.className}`}
          >
            {origin.label}
          </span>
          {shown.manual_lock && (
            <span title="Cargado a mano — ningún proceso automático toca esta ficha">🔒</span>
          )}
        </div>
      }
      subtitle={
        <div className="flex items-center gap-2 flex-wrap">
          <span>
            {[shown.rubro, shown.locality].filter(Boolean).join(" · ") || "Sin rubro"}
          </span>
          <span>· Prioridad {shown.contact_tier} — {TIER_LABEL[shown.contact_tier]}</span>
        </div>
      }
    >
      <div className="flex items-center justify-between gap-2 px-6 py-2 border-b border-[#2A2A2E]">
        <div className="flex gap-1">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`px-3 py-1.5 text-[13px] font-semibold rounded-sm transition-colors ${
                tab === key
                  ? "bg-[#E8231A]/10 text-[#FF6A5C] border border-[#E8231A]/20"
                  : "text-[#8A8A8A] hover:text-white border border-transparent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {position && (
          <div className="flex items-center gap-2 text-[13px] text-[#8A8A8A]">
            <button
              onClick={onPrev}
              disabled={!onPrev}
              className="px-1.5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Cliente anterior"
            >
              ↑
            </button>
            <span>
              {position.index + 1} de {position.total}
            </span>
            <button
              onClick={onNext}
              disabled={!onNext}
              className="px-1.5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Cliente siguiente"
            >
              ↓
            </button>
          </div>
        )}
      </div>

      {tab === "resumen" && (
        <div className="px-6 py-4 space-y-5">
          <div className="flex items-center gap-3">
            <ContactDots c={shown} />
            {shown.whatsapp_phone && (
              <button
                onClick={() =>
                  startTransition(async () => {
                    const id = await openConversation(shown.id);
                    router.push(`/admin/inbox?c=${id}`);
                  })
                }
                className="text-[13px] font-semibold text-green-400 hover:text-green-300"
              >
                Abrir en la Bandeja →
              </button>
            )}
          </div>

          <div>
            <p className="text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5">
              Contacto
            </p>
            <Row label="WhatsApp">
              {shown.whatsapp_phone ? (
                <>
                  <Link href={`https://wa.me/${shown.whatsapp_phone}`}>
                    {formatArPhone(shown.whatsapp_phone)}
                  </Link>
                  {shown.whatsapp_source && (
                    <span className="text-[#8A8A8A]">
                      {" "}
                      — confirmado {WHATSAPP_SOURCE_LABEL[shown.whatsapp_source] ?? shown.whatsapp_source}
                    </span>
                  )}
                </>
              ) : shown.whatsapp_likely ? (
                <span className="text-[#8A8A8A]">
                  Sin confirmar — el teléfono parece un celular
                </span>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Email">
              {shown.email ? <Link href={`mailto:${shown.email}`}>{shown.email}</Link> : "—"}
            </Row>
            <Row label="Teléfono">
              {shown.phone ? (
                <Link href={`tel:+${shown.phone}`}>{formatArPhone(shown.phone)}</Link>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Dirección">{shown.address ?? "—"}</Row>
          </div>

          <div>
            <p className="text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5">
              En la web
            </p>
            <Row label="Sitio">
              {shown.website ? <Link href={shown.website}>{shown.website}</Link> : "—"}
            </Row>
            <Row label="Instagram">
              {shown.instagram_url ? <Link href={shown.instagram_url}>Ver perfil</Link> : "—"}
            </Row>
            <Row label="Facebook">
              {shown.facebook_url ? <Link href={shown.facebook_url}>Ver perfil</Link> : "—"}
            </Row>
            <Row label="LinkedIn">
              {shown.linkedin_url ? <Link href={shown.linkedin_url}>Ver perfil</Link> : "—"}
            </Row>
          </div>

          <ClientDeals contactId={shown.id} stages={stages} />

          <div>
            <p className="text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5">
              De dónde salió
            </p>
            <Row label="Origen">{origin.label}</Row>
            <Row label="En Google">
              {shown.rating != null ? (
                <>
                  ★ {shown.rating}
                  {shown.reviews_count != null && ` (${shown.reviews_count} reseñas)`}
                  {shown.google_maps_url && (
                    <>
                      {" · "}
                      <Link href={shown.google_maps_url}>Ver en Maps</Link>
                    </>
                  )}
                </>
              ) : shown.google_maps_url ? (
                <Link href={shown.google_maps_url}>Ver en Maps</Link>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Datos de Google">
              {shown.google_synced_at ? `traídos el ${fmtDate(shown.google_synced_at)}` : "—"}
            </Row>
            <Row label="Alta en el CRM">{fmtDate(shown.created_at)}</Row>
            {shown.outreach_at && (
              <Row label="Contactado en frío">
                {fmtDate(shown.outreach_at)}
                {shown.outreach_count > 1 && ` · ${shown.outreach_count} veces`}
              </Row>
            )}
          </div>

          <div>
            <p className="text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5">
              Búsqueda de datos
            </p>
            <Row label="Hasta dónde llegó">
              {ENRICHMENT_LEVEL_LABEL[shown.enrichment_level] ?? `Nivel ${shown.enrichment_level}`}
            </Row>
            <Row label="Estado">
              {shown.enrichment_status}
              {shown.scrape_attempts > 0 && ` · ${shown.scrape_attempts} intento(s)`}
              {shown.last_scraped_at && ` · último ${fmtDate(shown.last_scraped_at)}`}
            </Row>
            {/* Este texto solo existía como globito al pasar el mouse sobre un
                estado, así que en la práctica nadie lo leía nunca. */}
            {shown.enrichment_error && (
              <Row label="Por qué falló">
                <span className="text-[#FF6A5C]">{shown.enrichment_error}</span>
              </Row>
            )}
            {shown.notes && (
              <Row label="Notas del robot">
                <span className="whitespace-pre-wrap">{shown.notes}</span>
              </Row>
            )}
          </div>
        </div>
      )}

      {tab === "actividad" && (
        <div className="h-full">
          <ClientTimeline
            contactId={shown.id}
            members={members}
            currentUserId={currentUserId}
            canModerate={canModerate}
          />
        </div>
      )}

      {tab === "datos" && (
        <ClientDataForm
          client={shown}
          canDelete={canModerate}
          onDeleted={onClose}
          onSaved={refreshCurrent}
        />
      )}
    </Drawer>
  );
}
