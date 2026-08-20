"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOutreachContext, sendOutreach, openConversation } from "@/app/admin/outreach-actions";
import { formatArPhone } from "@/lib/phone";
import type { OutreachContext } from "@/app/admin/outreach-actions";
import type { CrmContact } from "@/lib/types";

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} días`;
}

/**
 * Panel para escribirle a un cliente desde la plataforma.
 *
 * Lo que ordena esta pantalla es la **ventana de 24 horas** de Meta: con la
 * conexión oficial, el texto libre solo se puede mandar dentro de las 24 h
 * posteriores al último mensaje del cliente; fuera de eso hay que usar una
 * plantilla aprobada. Hoy el transporte es Evolution, que no aplica esa regla,
 * pero la ventana se muestra igual para que el día que se migre no cambie nada
 * más que el transporte — y para que nadie mande algo que Meta rechazaría.
 */
export default function OutreachPanel({
  client,
  onClose,
}: {
  client: CrmContact;
  onClose: () => void;
}) {
  const router = useRouter();
  const [ctx, setCtx] = useState<OutreachContext | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [mode, setMode] = useState<"template" | "free">("template");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    getOutreachContext(client.id)
      .then((c) => {
        setCtx(c);
        setSelected(c.previews[0]?.template.id ?? null);
        // Si la ventana está abierta, el cliente nos escribió recién: lo
        // natural es contestarle con texto propio, no con una plantilla.
        if (c.window.open) setMode("free");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error desconocido"));
  }, [client.id]);

  async function handleOpenInbox() {
    setBusy(true);
    try {
      await openConversation(client.id);
      router.push("/admin/inbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setBusy(false);
    }
  }

  async function handleSend() {
    setBusy(true);
    setError(null);
    try {
      await sendOutreach({
        contactId: client.id,
        templateId: mode === "template" ? (selected ?? undefined) : undefined,
        text: mode === "free" ? freeText : undefined,
      });
      setSent("Mensaje enviado. La conversación quedó abierta en la Bandeja.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  const preview = ctx?.previews.find((p) => p.template.id === selected);
  const quotaLeft = ctx ? ctx.quota.limit - ctx.quota.used : 0;
  const isCold = ctx ? !ctx.window.open : true;
  const canSend =
    !busy &&
    !sent &&
    ctx?.phone &&
    (!isCold || quotaLeft > 0) &&
    (mode === "template" ? Boolean(selected) : freeText.trim().length > 0);

  return (
    <tr className="bg-[#0D0D0F] border-b border-[#2A2A2E]">
      <td colSpan={7} className="px-5 py-4">
        {!ctx && !error && <p className="text-xs text-[#8A8A8A]">Cargando…</p>}

        {ctx && (
          <div className="max-w-3xl space-y-3">
            {/* Estado de la ventana: es la información que decide todo lo demás */}
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              {ctx.window.open ? (
                <span className="px-2 py-1 rounded-sm border border-green-500/20 bg-green-500/10 text-green-400">
                  Ventana abierta · quedan {ctx.window.hoursLeft} h para escribir libre
                </span>
              ) : (
                <span className="px-2 py-1 rounded-sm border border-[#2A2A2E] bg-[#1A1A1E] text-[#B0B0B0]">
                  {ctx.window.neverContacted
                    ? "Contacto en frío · nunca nos escribió"
                    : `Ventana cerrada · último mensaje suyo ${timeAgo(ctx.window.lastInboundAt!)}`}
                </span>
              )}

              <span className="text-[#8A8A8A]">
                Mensajes en frío hoy:{" "}
                <span className={quotaLeft <= 0 ? "text-[#E8231A]" : "text-white"}>
                  {ctx.quota.used}/{ctx.quota.limit}
                </span>
              </span>

              {ctx.phone ? (
                <span className="text-[#8A8A8A]">{formatArPhone(ctx.phone)}</span>
              ) : (
                <span className="text-[#E8231A]">Sin número</span>
              )}

              {ctx.alreadyContactedAt && (
                <span className="text-yellow-400" title="Ya se le escribió antes en frío">
                  Ya contactado {timeAgo(ctx.alreadyContactedAt)}
                </span>
              )}
            </div>

            {isCold && ctx.transport === "meta" && (
              <p className="text-[11px] text-[#8A8A8A]">
                Con la conexión oficial de Meta, fuera de la ventana solo se puede mandar una
                plantilla aprobada.
              </p>
            )}

            {/* Elegir qué mandar */}
            <div className="flex gap-2 text-[11px]">
              <button
                onClick={() => setMode("template")}
                className={`px-3 py-1.5 rounded-sm border transition-colors ${
                  mode === "template"
                    ? "border-[#E8231A]/30 bg-[#E8231A]/10 text-[#E8231A]"
                    : "border-[#2A2A2E] text-[#8A8A8A] hover:text-white"
                }`}
              >
                Plantilla
              </button>
              <button
                onClick={() => setMode("free")}
                className={`px-3 py-1.5 rounded-sm border transition-colors ${
                  mode === "free"
                    ? "border-[#E8231A]/30 bg-[#E8231A]/10 text-[#E8231A]"
                    : "border-[#2A2A2E] text-[#8A8A8A] hover:text-white"
                }`}
              >
                Texto libre
              </button>
            </div>

            {mode === "template" ? (
              ctx.previews.length === 0 ? (
                <p className="text-[11px] text-[#8A8A8A]">
                  No hay plantillas activas.{" "}
                  <a href="/admin/plantillas" className="text-[#B0B0B0] underline underline-offset-4 hover:text-white">
                    Crear una
                  </a>
                </p>
              ) : (
                <>
                  <select
                    value={selected ?? ""}
                    onChange={(e) => setSelected(e.target.value)}
                    className="bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-2.5 py-1.5 text-xs text-white focus:border-[#E8231A] focus:outline-none"
                  >
                    {ctx.previews.map((p) => (
                      <option key={p.template.id} value={p.template.id}>
                        {p.template.name}
                        {p.template.status !== "aprobada" ? ` (${p.template.status})` : ""}
                      </option>
                    ))}
                  </select>
                  {/* Vista previa con los datos ya reemplazados: es lo único
                      que evita mandar un "Hola {{1}}," a un cliente real. */}
                  <pre className="text-xs text-[#B0B0B0] bg-[#141416] border border-[#2A2A2E] rounded-sm p-3 whitespace-pre-wrap font-sans">
                    {preview?.text ?? ""}
                  </pre>
                </>
              )
            ) : (
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                rows={4}
                placeholder="Escribí el mensaje…"
                className="w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-3 py-2 text-xs text-white placeholder:text-[#8A8A8A] focus:border-[#E8231A] focus:outline-none"
              />
            )}

            {error && (
              <p className="text-[11px] text-[#E8231A] bg-[#E8231A]/5 border border-[#E8231A]/20 rounded-sm px-3 py-2">
                {error}
              </p>
            )}
            {sent && (
              <p className="text-[11px] text-green-400 bg-green-500/5 border border-green-500/20 rounded-sm px-3 py-2">
                {sent}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="px-5 py-1.5 bg-[#E8231A] text-white font-display font-bold text-[11px] tracking-widest uppercase rounded-sm hover:bg-[#C41D16] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {busy ? "Enviando…" : "Enviar"}
              </button>
              <button
                onClick={handleOpenInbox}
                disabled={busy}
                className="px-4 py-1.5 text-[11px] font-display font-semibold text-[#B0B0B0] hover:text-white bg-[#1A1A1E] hover:bg-[#2A2A2E] border border-[#2A2A2E] rounded-sm transition-colors"
                title="Crea la conversación sin mandar nada, para escribirla a mano desde la Bandeja"
              >
                Abrir en la Bandeja
              </button>
              {ctx.phone && (
                <a
                  href={`https://wa.me/${ctx.phone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-1.5 text-[11px] font-display font-semibold text-[#8A8A8A] hover:text-white transition-colors"
                  title="Abre WhatsApp fuera de la plataforma, desde tu propio número"
                >
                  Abrir en mi WhatsApp
                </a>
              )}
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-[11px] font-display font-semibold text-[#8A8A8A] hover:text-white transition-colors"
              >
                Cerrar
              </button>
            </div>

            {isCold && quotaLeft <= 0 && (
              <p className="text-[11px] text-[#E8231A]">
                Llegaste al tope de mensajes en frío del día. El tope existe para que WhatsApp no
                limite la línea.
              </p>
            )}
          </div>
        )}

        {error && !ctx && <p className="text-[11px] text-[#E8231A]">{error}</p>}
      </td>
    </tr>
  );
}
