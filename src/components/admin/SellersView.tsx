"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { excludeNumber } from "@/app/admin/line-actions";
import { clientLabel } from "@/lib/types";
import type { SellerStat, ReviewRow } from "@/app/admin/review-actions";

function fmtResponse(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

const TONE_STYLE: Record<string, string> = {
  bien: "text-green-400",
  regular: "text-yellow-400",
  malo: "text-[#FF6A5C]",
};

export default function SellersView({
  stats,
  reviews,
  queue,
  members,
  days,
}: {
  stats: SellerStat[];
  reviews: ReviewRow[];
  queue: { pending: number; failed: number };
  members: Record<string, string>;
  days: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmExclude, setConfirmExclude] = useState<string | null>(null);

  const personales = reviews.filter((r) => r.personal);
  const hallazgos = reviews.filter((r) => !r.personal);

  async function handleExclude(phone: string) {
    setBusy(phone);
    setError(null);
    try {
      const r = await excludeNumber(phone, "conversación de tono personal");
      setConfirmExclude(null);
      router.refresh();
      setError(
        `Listo: se excluyó el número y se borraron ${r.contacts} ficha(s) y ${r.messages} mensaje(s).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="text-[13px] text-[#B0B0B0] bg-[#141416] border border-[#2A2A2E] rounded-sm px-3 py-2">
          {error}
        </p>
      )}

      {/* ── Métricas ── */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-display font-bold text-lg text-white">
            Actividad de los últimos {days} días
          </h2>
          <p className="text-[13px] text-[#8A8A8A]">
            Estas cifras no usan IA: salen de contar mensajes y medir tiempos.
          </p>
        </div>

        <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-[#2A2A2E]">
                {["Línea", "Conversaciones", "Recibidos", "Enviados", "Tarda en contestar", "Sin contestar"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] ${
                        i === 0 ? "text-left" : "text-right"
                      }`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.line_id} className="border-b border-[#2A2A2E] last:border-0">
                  <td className="px-5 py-3">
                    <p className="text-white">{s.line_name}</p>
                    {s.member_id && members[s.member_id] && (
                      <p className="text-[13px] text-[#8A8A8A]">{members[s.member_id]}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-[#B0B0B0]">{s.conversations}</td>
                  <td className="px-5 py-3 text-right text-[#B0B0B0]">{s.messages_in}</td>
                  <td className="px-5 py-3 text-right text-[#B0B0B0]">{s.messages_out}</td>
                  <td className="px-5 py-3 text-right text-[#B0B0B0]">
                    {fmtResponse(s.median_response_s)}
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-display font-semibold ${
                      s.unanswered > 0 ? "text-[#FF6A5C]" : "text-[#8A8A8A]"
                    }`}
                    title="Conversaciones cuya última palabra fue del cliente"
                  >
                    {s.unanswered}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-[#8A8A8A] mt-2">
          &quot;Tarda en contestar&quot; es la mediana y no el promedio: un mensaje que entra a las
          23h y se responde a las 9h son diez horas que arruinan cualquier promedio, aunque todo lo
          demás se haya contestado en minutos.
        </p>
      </div>

      {/* ── Conversaciones personales ── */}
      {personales.length > 0 && (
        <div>
          <h2 className="font-display font-bold text-lg text-white mb-1">
            Conversaciones que parecen personales
          </h2>
          <p className="text-[13px] text-[#8A8A8A] mb-3 max-w-prose">
            La línea de un vendedor registra todo lo que pasa por ese número. Excluir borra lo ya
            guardado de ese contacto y deja de registrarlo de ahí en adelante.
          </p>
          <div className="space-y-2">
            {personales.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 bg-[#141416] border border-yellow-500/20 rounded-sm px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[15px] text-white truncate">
                    {r.contact ? clientLabel(r.contact) : "Contacto desconocido"}
                  </p>
                  <p className="text-[13px] text-[#8A8A8A] truncate">
                    {r.day} · {r.summary ?? "sin resumen"}
                  </p>
                </div>
                {r.contact?.phone &&
                  (confirmExclude === r.contact.phone ? (
                    <div className="flex items-center gap-3 text-[13px] shrink-0">
                      <span className="text-[#8A8A8A]">¿Excluir y borrar lo registrado?</span>
                      <button
                        onClick={() => handleExclude(r.contact!.phone!)}
                        disabled={busy === r.contact.phone}
                        className="text-[#FF6A5C] hover:text-white font-display font-semibold"
                      >
                        {busy === r.contact.phone ? "Borrando…" : "Confirmar"}
                      </button>
                      <button
                        onClick={() => setConfirmExclude(null)}
                        className="text-[#8A8A8A] hover:text-white"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmExclude(r.contact!.phone!)}
                      className="shrink-0 text-[13px] font-semibold text-[#B0B0B0] hover:text-white"
                    >
                      Excluir y borrar
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hallazgos ── */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="font-display font-bold text-lg text-white">Para revisar</h2>
          <p className="text-[13px] text-[#8A8A8A]">
            {queue.pending > 0 && `${queue.pending} en cola de análisis`}
            {queue.failed > 0 && ` · ${queue.failed} fallaron`}
          </p>
        </div>
        <p className="text-[13px] text-[#8A8A8A] mb-3 max-w-prose">
          Lo detecta la IA leyendo las conversaciones, así que se puede equivocar. Es una señal
          para mirar, no una calificación — conviene leer el hilo antes de sacar conclusiones.
        </p>

        {hallazgos.length === 0 ? (
          <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-8 text-center text-[15px] text-[#8A8A8A]">
            {queue.pending > 0
              ? "Todavía se está analizando."
              : "Nada para señalar en este período."}
          </div>
        ) : (
          <div className="space-y-3">
            {hallazgos.map((r) => (
              <div key={r.id} className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-4">
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
                  <a
                    href={r.contact ? `/admin/clientes?cliente=${r.contact.id}` : "#"}
                    className="text-[15px] font-display font-semibold text-white hover:text-[#FF6A5C] transition-colors"
                  >
                    {r.contact ? clientLabel(r.contact) : "Contacto desconocido"} →
                  </a>
                  <span className="text-[13px] text-[#8A8A8A]">
                    {r.day}
                    {r.member_id && members[r.member_id] && ` · ${members[r.member_id]}`}
                    {r.tone?.nivel && (
                      <span className={TONE_STYLE[r.tone.nivel] ?? ""}> · tono {r.tone.nivel}</span>
                    )}
                  </span>
                </div>

                {r.summary && <p className="text-[13px] text-[#B0B0B0] mb-2">{r.summary}</p>}

                {r.unanswered?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[12px] font-semibold tracking-wider uppercase text-[#FF6A5C] mb-1">
                      Quedó sin responder
                    </p>
                    <ul className="text-[13px] text-[#B0B0B0] space-y-0.5">
                      {r.unanswered.map((u, i) => (
                        <li key={i}>· {u}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {r.missed?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[12px] font-semibold tracking-wider uppercase text-yellow-400 mb-1">
                      Oportunidad
                    </p>
                    <ul className="text-[13px] text-[#B0B0B0] space-y-0.5">
                      {r.missed.map((m, i) => (
                        <li key={i}>· {m}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {r.tone?.nota && <p className="text-[13px] text-[#8A8A8A]">Tono: {r.tone.nota}</p>}
                {r.status === "failed" && (
                  <p className="text-[13px] text-[#FF6A5C]">No se pudo analizar: {r.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
