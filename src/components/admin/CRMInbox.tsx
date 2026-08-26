"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateMessageStatus,
  updateMessageNotes,
  deleteMessage,
  deleteMessages,
  markMessagesSpam,
  unmarkMessagesSpam,
  createDealFromMessage,
} from "@/app/admin/actions";
import type { ContactMessage } from "@/lib/types";
import { useToast } from "@/components/admin/Toast";

const STATUS_LABEL: Record<string, string> = {
  nuevo: "Nuevo",
  leido: "Leído",
  contactado: "Contactado",
  spam: "Spam",
};
const STATUS_COLOR: Record<string, string> = {
  nuevo: "bg-[#E8231A]/10 text-[#FF6A5C] border-[#E8231A]/20",
  leido: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  contactado: "bg-green-500/10 text-green-400 border-green-500/20",
  spam: "bg-[#2A2A2E] text-[#8A8A8A] border-[#2A2A2E]",
};
const INDUSTRY_LABEL: Record<string, string> = {
  supermercado: "Supermercado",
  restaurante: "Restaurante",
  farmacia: "Farmacia",
  logistica: "Logística",
  estacion: "Est. Servicio",
  hoteleria: "Hotelería",
  otro: "Otro",
};

/** Cuerpo del mail de respuesta, con la consulta citada abajo. */
function replyMailto(msg: ContactMessage): string {
  const asunto = `Re: su consulta en forcom.tech`;
  const cita = msg.message
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  const cuerpo = `Hola ${msg.name},\n\n\n\n---\nEl ${new Date(msg.created_at).toLocaleDateString(
    "es-AR"
  )} escribiste:\n${cita}`;
  return `mailto:${msg.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

/** WhatsApp con la consulta ya referenciada, para no arrancar de cero. */
function replyWhatsapp(msg: ContactMessage): string | null {
  if (!msg.phone) return null;
  const texto = `Hola ${msg.name}, te escribo de FORCOM por la consulta que nos dejaste en la web.`;
  return `https://wa.me/${msg.phone}?text=${encodeURIComponent(texto)}`;
}

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

export default function CRMInbox({
  messages,
  /** `?m=<id>` — el dashboard linkea directo al mensaje, ya expandido. */
  initialExpandedId = null,
}: {
  messages: ContactMessage[];
  initialExpandedId?: string | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(initialExpandedId);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  // Mensajes en la ventana de deshacer: se ocultan ya, se borran al expirar.
  const [borrandose, setBorrandose] = useState<Set<string>>(new Set());
  // Selección para las acciones en lote. Antes había que expandir cada mensaje
  // y borrarlo de a uno, en dos secciones distintas.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // El spam no se borra —queda para revisar si el filtro se comió algo—, pero
  // sale de la vista por defecto.
  const [showSpam, setShowSpam] = useState(false);

  // Si se llegó por link del dashboard, hay que scrollear hasta el mensaje:
  // con siete acordeones no alcanza con expandirlo.
  useEffect(() => {
    if (!initialExpandedId) return;
    document
      .getElementById(`msg-${initialExpandedId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [initialExpandedId]);

  function toggleExpand(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleStatusChange(id: string, status: ContactMessage["status"]) {
    startTransition(() => updateMessageStatus(id, status));
  }

  function handleSaveNotes(id: string) {
    startTransition(async () => {
      await updateMessageNotes(id, notes[id] ?? "");
      toast.show("Notas guardadas");
    });
  }

  /** Convierte la consulta en oportunidad y lleva al pipeline a verla. */
  function handleCreateDeal(msg: ContactMessage) {
    startTransition(async () => {
      try {
        await createDealFromMessage(msg.id);
        toast.show("Oportunidad creada", {
          detail: `${msg.company?.trim() || msg.name} — en la columna Nuevo.`,
          action: { label: "Ver pipeline", onAction: () => router.push("/admin/pipelines") },
          durationMs: 8000,
        });
      } catch (err) {
        toast.show(err instanceof Error ? err.message : "No se pudo crear la oportunidad.", {
          kind: "error",
        });
      }
    });
  }

  function handleMarkSpam() {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      try {
        const { clientesLimpiados } = await markMessagesSpam(ids);
        setSelected(new Set());
        toast.show(`${ids.length} marcado(s) como spam`, {
          detail:
            clientesLimpiados > 0
              ? `Se sacaron ${clientesLimpiados} de la base de Clientes.`
              : "No había fichas del formulario que limpiar.",
        });
      } catch (err) {
        toast.show(err instanceof Error ? err.message : "No se pudo marcar.", { kind: "error" });
      }
    });
  }

  function handleUnmarkSpam() {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      await unmarkMessagesSpam(ids);
      setSelected(new Set());
      toast.show(`${ids.length} devuelto(s) a "nuevo"`);
    });
  }

  function handleDeleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setSelected(new Set());
    setBorrandose((prev) => new Set([...prev, ...ids]));

    toast.undoable(
      `${ids.length} mensaje(s) eliminado(s)`,
      () => startTransition(() => deleteMessages(ids)),
      { detail: "El borrado en lote no tiene vuelta atrás una vez confirmado." }
    );

    setTimeout(() => {
      setBorrandose((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, RESTAURAR_MS);
  }

  function handleDelete(msg: ContactMessage) {
    setConfirmDelete(null);
    if (expanded === msg.id) setExpanded(null);
    setBorrandose((prev) => new Set(prev).add(msg.id));

    toast.undoable(
      "Mensaje eliminado",
      () => startTransition(() => deleteMessage(msg.id)),
      { detail: msg.name }
    );

    setTimeout(() => {
      setBorrandose((prev) => {
        const next = new Set(prev);
        next.delete(msg.id);
        return next;
      });
    }, RESTAURAR_MS);
  }

  const spamCount = messages.filter((m) => m.status === "spam").length;
  const visibles = messages
    .filter((m) => !borrandose.has(m.id))
    .filter((m) => (showSpam ? true : m.status !== "spam"));

  if (visibles.length === 0) {
    return (
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-12 text-center text-[#8A8A8A]">
        No hay mensajes todavía.
      </div>
    );
  }

  const allSelected = visibles.length > 0 && visibles.every((m) => selected.has(m.id));
  const soloSpamSeleccionado =
    selected.size > 0 && [...selected].every((id) => messages.find((m) => m.id === id)?.status === "spam");

  return (
    <div className="space-y-2">
      {/* Barra de lote. Vive siempre visible —no solo con selección— porque el
          filtro de spam también va acá: sin él no habría forma de revisar lo
          que el anti-bot descartó. */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 bg-[#141416] border border-[#2A2A2E] rounded-sm">
        <label className="flex items-center gap-2 text-[13px] text-[#B0B0B0] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              setSelected(allSelected ? new Set() : new Set(visibles.map((m) => m.id)))
            }
            className="accent-[#C41D16]"
          />
          {selected.size > 0 ? `${selected.size} seleccionado(s)` : "Seleccionar todos"}
        </label>

        {selected.size > 0 && (
          <>
            <span className="text-[#2A2A2E]">|</span>
            {soloSpamSeleccionado ? (
              <button
                onClick={handleUnmarkSpam}
                className="text-[13px] font-semibold text-[#B0B0B0] hover:text-white transition-colors"
              >
                No es spam
              </button>
            ) : (
              <button
                onClick={handleMarkSpam}
                title="Marca como spam y saca la ficha de Clientes si la había creado el formulario"
                className="text-[13px] font-semibold text-[#B0B0B0] hover:text-white transition-colors"
              >
                Marcar como spam
              </button>
            )}
            <button
              onClick={handleDeleteSelected}
              className="text-[13px] font-semibold text-[#8A8A8A] hover:text-[#FF6A5C] transition-colors"
            >
              Eliminar seleccionados
            </button>
          </>
        )}

        <div className="ml-auto">
          {spamCount > 0 && (
            <button
              onClick={() => setShowSpam((v) => !v)}
              className="text-[13px] font-semibold text-[#8A8A8A] hover:text-white transition-colors"
            >
              {showSpam ? "Ocultar spam" : `Ver spam (${spamCount})`}
            </button>
          )}
        </div>
      </div>

      {visibles.map((msg) => {
        const isExpanded = expanded === msg.id;
        const noteVal = notes[msg.id] ?? msg.admin_notes ?? "";

        return (
          <div
            key={msg.id}
            id={`msg-${msg.id}`}
            className={`bg-[#141416] border rounded-sm transition-colors ${
              msg.status === "spam"
                ? "border-[#2A2A2E] opacity-60"
                : msg.status === "nuevo"
                  ? "border-[#E8231A]/30"
                  : "border-[#2A2A2E]"
            }`}
          >
            {/* Header row */}
            <div
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#1A1A1E]/50 transition-colors"
              onClick={() => toggleExpand(msg.id)}
            >
              {/* El checkbox no puede propagar al acordeón: seleccionar para
                  borrar en lote y abrir el mensaje son dos intenciones
                  distintas. */}
              <input
                type="checkbox"
                checked={selected.has(msg.id)}
                onChange={() => toggleSelected(msg.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Seleccionar mensaje de ${msg.name}`}
                className="accent-[#C41D16] shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-display font-bold text-white">{msg.name}</span>
                  {msg.company && (
                    <span className="text-[#8A8A8A] text-[15px]">{msg.company}</span>
                  )}
                  {msg.industry && (
                    <span className="text-[13px] text-[#8A8A8A] bg-[#2A2A2E] px-2 py-0.5 rounded-sm">
                      {INDUSTRY_LABEL[msg.industry] ?? msg.industry}
                    </span>
                  )}
                </div>
                <p className="text-[#8A8A8A] text-[13px] mt-0.5">{msg.email}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`px-2.5 py-1 text-[12px] font-bold tracking-[0.1em] uppercase rounded-sm border ${STATUS_COLOR[msg.status]}`}
                >
                  {STATUS_LABEL[msg.status]}
                </span>
                <span className="text-[13px] text-[#8A8A8A] hidden sm:block">
                  {new Date(msg.created_at).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <svg
                  className={`w-4 h-4 text-[#8A8A8A] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-5 pb-5 border-t border-[#2A2A2E] pt-4 space-y-5">
                {/* Message */}
                <div>
                  <p className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">
                    Mensaje
                  </p>
                  <p className="text-[#B0B0B0] leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                </div>

                {/* ── Las tres salidas del lead ──────────────────────────────
                    Sin esto el panel es un visor: se leía la consulta acá, se
                    abría el cliente de correo, se copiaba el mail a mano, se
                    respondía afuera y se volvía a marcar "Contactado". Y el
                    Pipeline quedaba en cero, no por falta de oportunidades sino
                    porque nada las creaba. */}
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={replyMailto(msg)}
                    className="px-4 py-2 text-xs font-display font-bold tracking-wider uppercase rounded-sm bg-[#1A1A1E] border border-[#6A6A70] text-[#B0B0B0] hover:text-white hover:border-[#3A3A3E] transition-colors"
                  >
                    Responder por email
                  </a>
                  {replyWhatsapp(msg) && (
                    <a
                      href={replyWhatsapp(msg)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 text-xs font-display font-bold tracking-wider uppercase rounded-sm bg-[#1A1A1E] border border-green-500/25 text-green-400 hover:border-green-500/50 transition-colors"
                    >
                      Responder por WhatsApp
                    </a>
                  )}
                  <button
                    onClick={() => handleCreateDeal(msg)}
                    title="Crea la oportunidad en la columna Nuevo, con la consulta en las notas, y marca el mensaje como contactado"
                    className="px-4 py-2 text-xs font-display font-bold tracking-wider uppercase rounded-sm bg-[#C41D16] text-white hover:bg-[#E8231A] transition-colors"
                  >
                    Crear oportunidad
                  </button>
                </div>

                {/* Esta pantalla guarda el TEXTO del mensaje, que no vive en
                    ningún otro lado. La ficha del cliente (teléfono, WhatsApp,
                    historial de otros canales) vive en /admin/clientes. */}
                {msg.contact_id && (
                  <a
                    href={`/admin/clientes?q=${encodeURIComponent(msg.email)}`}
                    className="inline-block text-[13px] font-semibold text-[#B0B0B0] hover:text-white underline underline-offset-4"
                  >
                    Ver ficha del cliente →
                  </a>
                )}

                {/* Status change */}
                <div>
                  <p className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">
                    Cambiar estado
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {(["nuevo", "leido", "contactado"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(msg.id, s)}
                        className={`px-3 py-1.5 text-xs font-display font-bold tracking-wider uppercase rounded-sm border transition-colors ${
                          msg.status === s
                            ? STATUS_COLOR[s] + " cursor-default"
                            : "border-[#2A2A2E] text-[#8A8A8A] hover:border-[#E8231A]/30 hover:text-white"
                        }`}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Admin notes */}
                <div>
                  <p className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">
                    Notas internas
                  </p>
                  <textarea
                    value={noteVal}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [msg.id]: e.target.value }))
                    }
                    rows={2}
                    placeholder="Notas para el equipo (no se muestran al cliente)..."
                    className="w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-4 py-3 text-white placeholder:text-[#8A8A8A]/50 focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none transition-colors resize-none text-[15px]"
                  />
                  <button
                    onClick={() => handleSaveNotes(msg.id)}
                    className="mt-2 px-4 py-1.5 text-xs font-display font-bold tracking-wider uppercase bg-[#1A1A1E] border border-[#6A6A70] text-[#B0B0B0] hover:text-white hover:border-[#E8231A]/30 rounded-sm transition-colors"
                  >
                    Guardar notas
                  </button>
                </div>

                {/* Delete */}
                <div className="pt-2 border-t border-[#2A2A2E]">
                  {confirmDelete === msg.id ? (
                    <div className="flex items-center gap-3">
                      <span className="text-[15px] text-[#FF6A5C]">¿Eliminar este mensaje?</span>
                      <button
                        onClick={() => handleDelete(msg)}
                        className="px-4 py-1.5 text-[13px] font-bold bg-[#C41D16] text-white rounded-sm hover:bg-[#E8231A] transition-colors"
                      >
                        Sí, eliminar
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-[15px] text-[#8A8A8A] hover:text-white transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(msg.id)}
                      className="text-[13px] text-[#8A8A8A] hover:text-[#FF6A5C] font-semibold transition-colors"
                    >
                      Eliminar mensaje
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
