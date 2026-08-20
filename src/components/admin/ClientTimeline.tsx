"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getClientTimeline,
  addClientNote,
  updateClientNote,
  deleteClientNote,
} from "@/app/admin/client-actions";
import type { TimelineItem } from "@/lib/types";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  if (mins < 60 * 24) return `hace ${Math.floor(mins / 60)} h`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" });
}

function exactWhen(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Cómo se presenta cada tipo de ítem: qué dice el encabezado y de qué color. */
const KIND_STYLE: Record<string, { label: string; dot: string }> = {
  wa_in: { label: "WhatsApp — del cliente", dot: "bg-[#B0B0B0]" },
  wa_out: { label: "WhatsApp — nuestro", dot: "bg-[#E8231A]" },
  form_message: { label: "Mensaje del formulario web", dot: "bg-[#E8231A]" },
  from_search: { label: "Salió de una búsqueda", dot: "bg-blue-400" },
  note: { label: "Nota interna", dot: "bg-yellow-400" },
  deal_created: { label: "Oportunidad creada", dot: "bg-green-400" },
  deal_moved: { label: "Cambió de etapa", dot: "bg-green-400" },
  deal_updated: { label: "Oportunidad editada", dot: "bg-green-400" },
  deal_deleted: { label: "Oportunidad eliminada", dot: "bg-[#8A8A8A]" },
  edited: { label: "Ficha editada", dot: "bg-[#8A8A8A]" },
};

/** Texto del ítem, cuando el `body` crudo no alcanza para entenderlo. */
function describe(item: TimelineItem): string {
  const meta = item.meta ?? {};
  switch (item.kind) {
    case "deal_moved":
      return `${item.body ?? "Oportunidad"}: de ${meta.from ?? "—"} a ${meta.to ?? "—"}`;
    case "deal_created":
      return `${item.body ?? "Oportunidad"} · etapa ${meta.stage ?? "—"}`;
    case "edited":
      return `Se cambió: ${item.body ?? "—"}`;
    case "from_search":
      return `Búsqueda de ${item.body ?? "—"}`;
    default:
      return item.body ?? "—";
  }
}

export default function ClientTimeline({
  contactId,
  members,
  currentUserId,
  canModerate,
}: {
  contactId: string;
  /** id de miembro → nombre o email, resuelto una sola vez en la página. */
  members: Record<string, string>;
  currentUserId: string | null;
  /** owner/admin pueden borrar notas ajenas. La base lo valida igual. */
  canModerate: boolean;
}) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await getClientTimeline(contactId);
      setItems(page.items);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    // Al cambiar de cliente se vacía primero, para no mostrar por un instante
    // la historia del anterior con la cabecera del nuevo.
    setItems([]);
    setEditingNote(null);
    load();
    // Sin polling, al revés que la Bandeja: ahí estás esperando una respuesta
    // en vivo, acá no. Se recarga al abrir, al cambiar de cliente y después de
    // cada acción propia. Un poll acá serían 12 llamadas por minuto por
    // pestaña abierta que nadie está esperando.
  }, [contactId, load]);

  async function loadMore() {
    const last = items[items.length - 1];
    if (!last) return;
    try {
      const page = await getClientTimeline(contactId, last.at);
      setItems((prev) => [...prev, ...page.items]);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSavingNote(true);
    setError(null);
    try {
      await addClientNote(contactId, note);
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la nota");
    } finally {
      setSavingNote(false);
    }
  }

  async function saveEdit(id: string) {
    try {
      await updateClientNote(id, editDraft);
      setEditingNote(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al editar la nota");
    }
  }

  async function removeNote(id: string) {
    try {
      await deleteClientNote(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al borrar la nota");
    }
  }

  return (
    <div className="flex flex-col h-full">
      <form onSubmit={handleAddNote} className="px-6 py-4 border-b border-[#2A2A2E] shrink-0">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Nota interna — queda con tu nombre y la fecha"
          className="w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-3 py-2 text-xs text-white placeholder:text-[#8A8A8A] focus:border-[#E8231A] focus:outline-none resize-none"
        />
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={savingNote || !note.trim()}
            className="px-4 py-1.5 bg-[#E8231A] text-white font-display font-bold text-[11px] tracking-widest uppercase rounded-sm hover:bg-[#C41D16] disabled:opacity-40 transition-colors"
          >
            {savingNote ? "Guardando…" : "Agregar nota"}
          </button>
        </div>
      </form>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        {error && (
          <p className="text-xs text-[#E8231A] bg-[#E8231A]/5 border border-[#E8231A]/20 rounded-sm px-3 py-2 mb-3">
            {error}
          </p>
        )}

        {loading && items.length === 0 && <p className="text-xs text-[#8A8A8A]">Cargando…</p>}

        {!loading && items.length === 0 && (
          <p className="text-xs text-[#8A8A8A]">
            Todavía no pasó nada con este cliente.
          </p>
        )}

        <div className="space-y-4">
          {items.map((item) => {
            const style = KIND_STYLE[item.kind] ?? { label: item.kind, dot: "bg-[#8A8A8A]" };
            const author = item.actor_id ? members[item.actor_id] : null;
            const isNote = item.kind === "note";
            const canEdit = isNote && (canModerate || item.actor_id === currentUserId);

            return (
              <div key={`${item.source}-${item.ref_id}`} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0 pt-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                  <span className="flex-1 w-px bg-[#2A2A2E] mt-1.5" />
                </div>

                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[10px] font-display font-semibold tracking-wider uppercase text-[#8A8A8A]">
                      {style.label}
                    </span>
                    <span className="text-[10px] text-[#8A8A8A]" title={exactWhen(item.at)}>
                      {formatWhen(item.at)}
                    </span>
                    {author && <span className="text-[10px] text-[#8A8A8A]">· {author}</span>}
                    {item.meta?.is_outreach === true && (
                      <span className="text-[10px] text-yellow-400">· contacto en frío</span>
                    )}
                    {item.meta?.ai === true && (
                      <span className="text-[10px] text-blue-400">· la IA</span>
                    )}
                  </div>

                  {editingNote === item.ref_id ? (
                    <div className="mt-1.5">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={3}
                        className="w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-3 py-2 text-xs text-white focus:border-[#E8231A] focus:outline-none resize-none"
                      />
                      <div className="flex gap-3 mt-1.5 text-[11px]">
                        <button
                          onClick={() => saveEdit(item.ref_id)}
                          className="text-[#E8231A] hover:text-white"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditingNote(null)}
                          className="text-[#8A8A8A] hover:text-white"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className={`text-xs mt-1 whitespace-pre-wrap break-words ${
                        isNote ? "text-yellow-100/80" : "text-[#B0B0B0]"
                      }`}
                    >
                      {describe(item)}
                    </p>
                  )}

                  {canEdit && editingNote !== item.ref_id && (
                    <div className="flex gap-3 mt-1 text-[10px]">
                      <button
                        onClick={() => {
                          setEditingNote(item.ref_id);
                          setEditDraft(item.body ?? "");
                        }}
                        className="text-[#8A8A8A] hover:text-white"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => removeNote(item.ref_id)}
                        className="text-[#8A8A8A] hover:text-[#E8231A]"
                      >
                        Borrar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {hasMore && (
          <button
            onClick={loadMore}
            className="w-full mt-4 py-2 text-[11px] font-display font-semibold text-[#8A8A8A] hover:text-white border border-[#2A2A2E] rounded-sm transition-colors"
          >
            Ver más
          </button>
        )}
      </div>
    </div>
  );
}
