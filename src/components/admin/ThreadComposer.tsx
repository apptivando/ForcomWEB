"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { getOutreachContext, sendOutreach } from "@/app/admin/outreach-actions";
import { createQuickReply, deleteQuickReply } from "@/app/admin/actions";
import { formatArPhone } from "@/lib/phone";
import type { OutreachContext } from "@/app/admin/outreach-actions";
import type { CrmContact, QuickReply } from "@/lib/types";

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} días`;
}

/**
 * El pie del hilo de la Bandeja: dice en qué situación estás y te da la única
 * forma de escribir que corresponde a esa situación.
 *
 * ─── La ventana de 24 horas ───────────────────────────────────────────────
 * Es lo que ordena todo este componente. Con la conexión oficial de Meta, a un
 * cliente se le puede mandar texto libre SOLO dentro de las 24 horas
 * posteriores a SU último mensaje. Fuera de esa ventana —o sea, en todo primer
 * contacto— Meta únicamente acepta plantillas que haya aprobado antes.
 *
 * Por eso el cuadro de texto no está siempre: cuando la ventana está cerrada
 * se reemplaza por el selector de plantillas. No es una restricción que
 * inventamos nosotros, y esconder el cuadro es más honesto que dejarlo ahí
 * para que el envío falle después.
 *
 * Con Evolution (las líneas no oficiales) la regla no se aplica técnicamente,
 * pero la pantalla es la misma: así el día que se migre a Meta no cambia nada
 * más que el transporte, y mientras tanto nadie manda algo que Meta
 * rechazaría sin darse cuenta.
 */
export default function ThreadComposer({
  contact,
  conversationId,
  quickReplies,
  onQuickRepliesChange,
  onSent,
}: {
  contact: CrmContact;
  /** El hilo que se está mirando. Se manda ahí y no a "la conversación abierta
   *  del contacto", para que responder en un hilo cerrado no lo parta en dos. */
  conversationId: string;
  quickReplies: QuickReply[];
  onQuickRepliesChange: (next: QuickReply[]) => void;
  onSent: () => void;
}) {
  const [ctx, setCtx] = useState<OutreachContext | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showNewQuickReply, setShowNewQuickReply] = useState(false);
  const [newQrTitle, setNewQrTitle] = useState("");
  const [newQrBody, setNewQrBody] = useState("");

  const loadContext = useCallback(async () => {
    try {
      const next = await getOutreachContext(contact.id);
      setCtx(next);
      setTemplateId((prev) => prev ?? next.previews[0]?.template.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }, [contact.id]);

  useEffect(() => {
    // Al cambiar de conversación se descarta todo el estado del anterior: el
    // borrador a medio escribir de otro cliente es el peor mensaje posible.
    setCtx(null);
    setTemplateId(null);
    setDraft("");
    setError(null);
    setShowQuickReplies(false);
    loadContext();
  }, [contact.id, loadContext]);

  const windowOpen = ctx?.window.open ?? false;
  const quotaLeft = ctx ? ctx.quota.limit - ctx.quota.used : 0;
  const preview = ctx?.previews.find((p) => p.template.id === templateId);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    try {
      await sendOutreach({
        contactId: contact.id,
        conversationId,
        templateId: windowOpen ? undefined : (templateId ?? undefined),
        text: windowOpen ? draft.trim() : undefined,
      });
      setDraft("");
      onSent();
      await loadContext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar.");
    } finally {
      setSending(false);
    }
  }

  function handleCreateQuickReply() {
    if (!newQrTitle.trim() || !newQrBody.trim()) return;
    startTransition(async () => {
      try {
        await createQuickReply(newQrTitle, newQrBody);
        onQuickRepliesChange([
          ...quickReplies,
          {
            id: crypto.randomUUID(),
            title: newQrTitle.trim(),
            body: newQrBody.trim(),
            created_by: null,
            created_at: new Date().toISOString(),
          },
        ]);
        setNewQrTitle("");
        setNewQrBody("");
        setShowNewQuickReply(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar la respuesta rápida.");
      }
    });
  }

  function handleDeleteQuickReply(id: string) {
    startTransition(async () => {
      try {
        await deleteQuickReply(id);
        onQuickRepliesChange(quickReplies.filter((q) => q.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al borrar.");
      }
    });
  }

  const canSend =
    !sending &&
    Boolean(ctx?.phone) &&
    (windowOpen ? draft.trim().length > 0 : Boolean(templateId) && quotaLeft > 0);

  return (
    <div className="border-t border-[#2A2A2E]">
      {/* Estado de la ventana: es lo que decide qué se puede mandar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 pt-3 text-[13px]">
        {!ctx ? (
          <span className="text-[#8A8A8A]">Cargando estado…</span>
        ) : windowOpen ? (
          <span className="text-green-400">
            Podés escribir libre — quedan {ctx.window.hoursLeft} h de la ventana
          </span>
        ) : (
          <span className="text-[#B0B0B0]">
            {ctx.window.neverContacted
              ? "Nunca nos escribió."
              : `Ya pasaron las 24 h — su último mensaje fue ${timeAgo(ctx.window.lastInboundAt!)}.`}{" "}
            Para reabrir la conversación hay que mandar una plantilla.
          </span>
        )}

        {ctx && !windowOpen && (
          <span className="text-[#8A8A8A]">
            Mensajes en frío hoy:{" "}
            <span className={quotaLeft <= 0 ? "text-[#FF6A5C]" : "text-white"}>
              {ctx.quota.used}/{ctx.quota.limit}
            </span>
          </span>
        )}

        {ctx?.alreadyContactedAt && !windowOpen && (
          <span className="text-yellow-400" title="Ya se le escribió antes sin que respondiera">
            Ya contactado {timeAgo(ctx.alreadyContactedAt)}
          </span>
        )}

        {ctx && !ctx.phone && <span className="text-[#FF6A5C]">Sin número al que escribir</span>}

        {ctx?.phone && (
          <a
            href={`https://wa.me/${ctx.phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[#8A8A8A] hover:text-white"
            title={`Abrir ${formatArPhone(ctx.phone)} en tu propio WhatsApp, fuera de la plataforma`}
          >
            Abrir en mi WhatsApp
          </a>
        )}
      </div>

      <form onSubmit={handleSend} className="px-6 py-4">
        {error && (
          <p className="text-[15px] text-[#FF6A5C] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-3 py-2 mb-3 whitespace-pre-line">
            {error}
          </p>
        )}

        {/* Ventana abierta: texto libre, con las respuestas rápidas de siempre */}
        {windowOpen && showQuickReplies && (
          <div className="mb-3 bg-[#141416] border border-[#2A2A2E] rounded-sm p-3 max-h-48 overflow-y-auto">
            {quickReplies.length === 0 && !showNewQuickReply && (
              <p className="text-[13px] text-[#8A8A8A] px-2 py-1">Todavía no hay respuestas rápidas.</p>
            )}
            {quickReplies.map((qr) => (
              <div
                key={qr.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm hover:bg-[#1A1A1E]"
              >
                <button
                  type="button"
                  onClick={() => {
                    setDraft(qr.body);
                    setShowQuickReplies(false);
                  }}
                  className="flex-1 text-left"
                >
                  <p className="text-[13px] font-semibold text-white">{qr.title}</p>
                  <p className="text-[13px] text-[#8A8A8A] truncate">{qr.body}</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteQuickReply(qr.id)}
                  className="text-[#8A8A8A] hover:text-[#FF6A5C] text-[13px] shrink-0"
                >
                  Borrar
                </button>
              </div>
            ))}

            {showNewQuickReply ? (
              <div className="mt-2 pt-2 border-t border-[#2A2A2E] space-y-2">
                <input
                  value={newQrTitle}
                  onChange={(e) => setNewQrTitle(e.target.value)}
                  placeholder="Título (ej. Horario)"
                  className="w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-3 py-2 text-[13px] text-white focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none"
                />
                <textarea
                  value={newQrBody}
                  onChange={(e) => setNewQrBody(e.target.value)}
                  placeholder="Texto del mensaje"
                  rows={2}
                  className="w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-3 py-2 text-[13px] text-white focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none resize-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateQuickReply}
                    className="px-3 py-1.5 bg-[#C41D16] text-white text-[13px] font-bold rounded-sm hover:bg-[#E8231A]"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewQuickReply(false)}
                    className="px-3 py-1.5 text-[13px] text-[#8A8A8A] hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewQuickReply(true)}
                className="w-full text-left px-2 py-1.5 mt-1 text-[13px] text-[#FF6A5C] hover:bg-[#1A1A1E] rounded-sm"
              >
                + Agregar respuesta rápida
              </button>
            )}
          </div>
        )}

        {/* Ventana cerrada: la vista previa con los datos del cliente ya
            reemplazados es lo único que evita mandarle un "Hola {{1}}," a
            alguien de verdad. */}
        {ctx && !windowOpen && (
          <div className="mb-3">
            {ctx.previews.length === 0 ? (
              <p className="text-[13px] text-[#8A8A8A] bg-[#141416] border border-[#2A2A2E] rounded-sm px-3 py-3">
                No hay plantillas activas.{" "}
                <a
                  href="/admin/plantillas"
                  className="text-[#B0B0B0] underline underline-offset-4 hover:text-white"
                >
                  Crear una
                </a>
              </p>
            ) : (
              <>
                <select
                  value={templateId ?? ""}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-3 py-2 text-[13px] text-white focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none mb-2"
                >
                  {ctx.previews.map((p) => (
                    <option key={p.template.id} value={p.template.id}>
                      {p.template.name}
                      {p.template.status !== "aprobada" ? ` (${p.template.status})` : ""}
                    </option>
                  ))}
                </select>
                <pre className="text-[13px] text-[#B0B0B0] bg-[#141416] border border-[#2A2A2E] rounded-sm p-3 whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">
                  {preview?.text ?? ""}
                </pre>
                {/* Limpiar los espacios sobrantes disimula el hueco pero no
                    arregla la frase: "trabajan en y quería contarte" sigue
                    estando mal escrita. Por eso se avisa en vez de confiar en
                    que alguien lea la vista previa con atención. */}
                {preview && preview.missing.length > 0 && (
                  <p className="text-[13px] text-yellow-400 mt-2">
                    A la ficha le falta {preview.missing.join(" y ")}, así que esa parte del
                    mensaje queda incompleta. Convendría completar el dato antes de enviar.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex gap-3">
          {windowOpen && (
            <button
              type="button"
              onClick={() => setShowQuickReplies((v) => !v)}
              className="px-3 py-3 border border-[#2A2A2E] rounded-sm text-[#8A8A8A] hover:text-white hover:border-[#E8231A]/40 transition-colors shrink-0"
              title="Respuestas rápidas"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          )}

          {windowOpen ? (
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribí una respuesta..."
              className="flex-1 bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-4 py-3 text-white placeholder:text-[#8A8A8A]/50 focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none transition-colors"
            />
          ) : (
            <p className="flex-1 self-center text-[13px] text-[#8A8A8A]">
              {quotaLeft <= 0
                ? "Llegaste al tope de mensajes en frío del día. El tope existe para que WhatsApp no limite la línea."
                : "Se va a enviar la plantilla de arriba, tal como se ve."}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSend}
            className="px-6 py-3 bg-[#C41D16] text-white font-display font-bold text-[15px] tracking-widest uppercase rounded-sm hover:bg-[#E8231A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? "..." : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}
