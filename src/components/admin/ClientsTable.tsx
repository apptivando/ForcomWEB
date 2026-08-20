"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clientLabel, clientSubLabel } from "@/lib/types";
import { formatArPhone } from "@/lib/phone";
import { updateClient, deleteClient, requeueClient, exportClients } from "@/app/admin/actions";
import type { ClientFilters } from "@/app/admin/actions";
import OutreachPanel from "@/components/admin/OutreachPanel";
import type { CrmContact, ClientOrigin, ContactTier } from "@/lib/types";

/** Escapa un campo para CSV: comillas dobladas y todo entre comillas. */
function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

const CSV_COLUMNS: Array<[string, (c: CrmContact) => unknown]> = [
  ["Prioridad", (c) => c.contact_tier],
  ["Razón social", (c) => c.business_name],
  ["Nombre de contacto", (c) => c.contact_name],
  ["Origen", (c) => c.origin],
  ["WhatsApp", (c) => (c.whatsapp_phone ? `+${c.whatsapp_phone}` : "")],
  ["Email", (c) => c.email],
  ["Teléfono", (c) => (c.phone ? `+${c.phone}` : "")],
  ["Rubro", (c) => c.rubro],
  ["Localidad", (c) => c.locality],
  ["Dirección", (c) => c.address],
  ["Sitio web", (c) => c.website],
  ["Instagram", (c) => c.instagram_url],
  ["Facebook", (c) => c.facebook_url],
  ["Google Maps", (c) => c.google_maps_url],
  ["Rating", (c) => c.rating],
  ["Reseñas", (c) => c.reviews_count],
  ["Estado", (c) => c.enrichment_status],
  ["Notas", (c) => c.notes],
];

function downloadCsv(clients: CrmContact[]) {
  const header = CSV_COLUMNS.map(([name]) => csvCell(name)).join(";");
  const rows = clients.map((c) => CSV_COLUMNS.map(([, get]) => csvCell(get(c))).join(";"));
  // Punto y coma como separador y BOM al inicio: es lo que Excel en español
  // espera. Con coma y sin BOM abre todo en una sola columna y rompe los
  // acentos, que es exactamente lo que nadie quiere de un export.
  const csv = `﻿${[header, ...rows].join("\r\n")}`;

  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `clientes-forcom-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const ORIGIN_STYLE: Record<ClientOrigin, { label: string; className: string }> = {
  busqueda: { label: "Búsqueda", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  whatsapp: { label: "WhatsApp", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  formulario: { label: "Formulario", className: "bg-[#E8231A]/10 text-[#E8231A] border-[#E8231A]/20" },
  manual: { label: "Manual", className: "bg-[#2A2A2E] text-[#B0B0B0] border-[#2A2A2E]" },
};

const TIER_LABEL: Record<ContactTier, string> = {
  1: "Con WhatsApp",
  2: "Con email",
  3: "Solo teléfono",
  4: "Sin contacto",
};

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  pending: { text: "En cola", className: "text-[#8A8A8A]" },
  running: { text: "Buscando…", className: "text-blue-400" },
  failed: { text: "Falló", className: "text-[#E8231A]" },
};

/** Los tres puntitos de contacto. Comunican la prioridad de un vistazo. */
function ContactDots({ c }: { c: CrmContact }) {
  const items = [
    { on: !!c.whatsapp_phone, label: "WhatsApp", text: "WA", color: "text-green-400 border-green-500/30 bg-green-500/10" },
    { on: !!c.email, label: c.email ?? "Email", text: "@", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
    { on: !!c.phone, label: c.phone ?? "Teléfono", text: "Tel", color: "text-[#B0B0B0] border-[#2A2A2E] bg-[#1A1A1E]" },
  ];
  return (
    <div className="flex items-center gap-1">
      {items.map((it) => (
        <span
          key={it.text}
          title={it.on ? it.label : `Sin ${it.text}`}
          className={`px-1.5 py-0.5 text-[10px] font-display font-bold rounded-sm border ${
            it.on ? it.color : "text-[#3A3A3E] border-[#1F1F23] bg-transparent"
          }`}
        >
          {it.text}
        </span>
      ))}
      {/* Solo informativo: el teléfono de Google venía marcado como celular.
          No cuenta como WhatsApp confirmado y por eso no cambia la prioridad. */}
      {!c.whatsapp_phone && c.whatsapp_likely && (
        <span
          title="El teléfono parece un celular — puede tener WhatsApp, pero no está confirmado"
          className="px-1.5 py-0.5 text-[10px] font-display rounded-sm border border-dashed border-green-500/25 text-green-500/50"
        >
          ?
        </span>
      )}
    </div>
  );
}

/** Formulario de carga manual — la salida del nivel 4 de la cascada. */
function EditRow({ client, onDone }: { client: CrmContact; onDone: () => void }) {
  const [form, setForm] = useState({
    business_name: client.business_name ?? "",
    contact_name: client.contact_name ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    whatsapp_phone: client.whatsapp_phone ?? "",
    notes: client.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const field = "bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-2.5 py-1.5 text-xs text-white placeholder:text-[#8A8A8A] focus:border-[#E8231A] focus:outline-none";

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateClient(client.id, form);
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="bg-[#0D0D0F] border-b border-[#2A2A2E]">
      <td colSpan={7} className="px-5 py-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl">
          <input className={field} placeholder="Razón social" value={form.business_name}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
          <input className={field} placeholder="Nombre de contacto" value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          <input className={field} placeholder="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={field} placeholder="Teléfono — ej. 351 421-8834" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className={field} placeholder="WhatsApp — ej. 351 518-1882" value={form.whatsapp_phone}
            onChange={(e) => setForm({ ...form, whatsapp_phone: e.target.value })} />
          <input className={field} placeholder="Notas" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        <p className="text-[10px] text-[#8A8A8A] mt-2">
          Lo que guardes acá queda fijo: ningún proceso automático vuelve a tocar esta ficha.
        </p>
        {error && <p className="text-[11px] text-[#E8231A] mt-1">{error}</p>}

        <div className="flex gap-2 mt-3">
          <button onClick={save} disabled={saving}
            className="px-4 py-1.5 bg-[#E8231A] text-white font-display font-bold text-[11px] tracking-widest uppercase rounded-sm hover:bg-[#C41D16] disabled:opacity-40 transition-colors">
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button onClick={onDone}
            className="px-4 py-1.5 text-[11px] font-display font-semibold text-[#8A8A8A] hover:text-white transition-colors">
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function ClientsTable({
  clients,
  tierCounts,
  filtered,
  canDelete,
  filters,
}: {
  clients: CrmContact[];
  tierCounts: Record<ContactTier, number>;
  /** Si hay filtros activos, no se agrupa: la agrupación confundiría los conteos. */
  filtered: boolean;
  canDelete: boolean;
  /** Los mismos filtros que produjeron esta página, para exportar el conjunto completo. */
  filters: ClientFilters;
}) {
  // El grupo 4 arranca colapsado: son los que no tienen nada y no se trabajan
  // hasta que el enriquecimiento termine.
  const [collapsed, setCollapsed] = useState<Set<ContactTier>>(new Set<ContactTier>([4]));
  const [editing, setEditing] = useState<string | null>(null);
  const [writing, setWriting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Se exporta todo lo que coincida con los filtros, no solo la página que se
  // ve: nadie quiere bajar 30 CSV de 50 filas para tener la lista completa.
  async function handleExport() {
    setExporting(true);
    try {
      downloadCsv(await exportClients(filters));
    } catch {
      // Si el servidor falla, al menos se baja lo que ya está en pantalla.
      downloadCsv(clients);
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
                <Fragment key={c.id}>
                <tr
                  className={`border-b border-[#2A2A2E] last:border-0 ${i % 2 === 0 ? "" : "bg-[#1A1A1E]/30"}`}
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

                  <td className="px-5 py-3">
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

                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2 text-[11px] whitespace-nowrap">
                      {c.manual_lock && (
                        <span
                          title="Cargado a mano — ningún proceso automático toca esta ficha"
                          className="text-[#8A8A8A]"
                        >
                          🔒
                        </span>
                      )}
                      {/* Solo tiene sentido si hay a dónde escribir. Se
                          prefiere el WhatsApp confirmado, pero un teléfono
                          suelto también sirve para intentarlo. */}
                      {(c.whatsapp_phone || c.phone) && (
                        <button
                          onClick={() => {
                            setWriting(writing === c.id ? null : c.id);
                            setEditing(null);
                          }}
                          className="text-green-400 hover:text-green-300"
                        >
                          Escribir
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditing(editing === c.id ? null : c.id);
                          setWriting(null);
                        }}
                        className="text-[#B0B0B0] hover:text-white"
                      >
                        Editar
                      </button>
                      {/* Se ofrece siempre salvo que ya esté en la cola o
                          cargado a mano (esas fichas quedan excluidas del
                          enriquecedor a propósito). Antes se escondía cuando la
                          prioridad era 1, lo cual estaba mal: un contacto puede
                          tener WhatsApp y seguir sin email, y el enriquecedor
                          solo se da por satisfecho cuando tiene los dos. */}
                      {!c.manual_lock && c.enrichment_status !== "pending" && (
                        <button
                          onClick={() => startTransition(async () => {
                            await requeueClient(c.id);
                            router.refresh();
                          })}
                          className="text-[#8A8A8A] hover:text-white"
                          title="Vuelve a ponerlo en la cola y reintenta desde cero"
                        >
                          Re-buscar
                        </button>
                      )}
                      {canDelete && (
                        confirmDelete === c.id ? (
                          <>
                            <button
                              onClick={() => startTransition(async () => {
                                await deleteClient(c.id);
                                setConfirmDelete(null);
                                router.refresh();
                              })}
                              className="text-[#E8231A] hover:text-white"
                            >
                              Confirmar
                            </button>
                            <button onClick={() => setConfirmDelete(null)} className="text-[#8A8A8A] hover:text-white">
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(c.id)}
                            className="text-[#8A8A8A] hover:text-[#E8231A]"
                          >
                            Eliminar
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
                {editing === c.id && <EditRow client={c} onDone={() => setEditing(null)} />}
                {writing === c.id && <OutreachPanel client={c} onClose={() => setWriting(null)} />}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
