"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  createWaLine,
  getLineQr,
  refreshLineStates,
  disconnectWaLine,
  deleteWaLine,
  updateWaLine,
  type LineQr,
} from "@/app/admin/line-actions";
import { formatArPhone } from "@/lib/phone";
import type { WaLine } from "@/lib/types";

const STATE_STYLE: Record<string, { label: string; className: string }> = {
  open: { label: "Conectada", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  connecting: { label: "Conectando…", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  close: { label: "Desconectada", className: "bg-[#E8231A]/10 text-[#FF6A5C] border-[#E8231A]/20" },
};

function when(iso: string | null): string {
  if (!iso) return "nunca";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `hace ${mins} min`;
  if (mins < 60 * 24) return `hace ${Math.floor(mins / 60)} h`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

const field =
  "bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-3 py-2 text-[15px] text-white placeholder:text-[#8A8A8A] focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none";

export default function LinesManager({
  lines,
  members,
  managerUrl,
}: {
  lines: WaLine[];
  members: Array<{ user_id: string; email: string }>;
  /** El Manager de Evolution, como salida cuando el QR no viene por la API. */
  managerUrl: string | null;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [memberId, setMemberId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<{ lineId: string; data: LineQr } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="text-[13px] text-[#FF6A5C] bg-[#E8231A]/5 border border-[#E8231A]/20 rounded-sm px-3 py-2 whitespace-pre-line">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="px-5 py-2.5 bg-[#C41D16] text-white font-display font-bold text-xs tracking-widest uppercase rounded-sm hover:bg-[#E8231A] transition-colors"
          >
            + Conectar una línea
          </button>
        )}
        <button
          onClick={() => run(refreshLineStates)}
          disabled={busy}
          className="px-4 py-2.5 text-[13px] font-semibold text-[#B0B0B0] hover:text-white bg-[#1A1A1E] hover:bg-[#2A2A2E] border border-[#6A6A70] rounded-sm disabled:opacity-40 transition-colors"
        >
          {busy ? "Consultando…" : "Actualizar estados"}
        </button>
      </div>

      {adding && (
        <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              className={field}
              placeholder="Nombre — ej. Juan Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className={field}
              placeholder="Número (opcional) — ej. 351 518-1882"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <select className={field} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">Sin usuario asociado</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.email}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[13px] text-[#8A8A8A]">
            Asociar el usuario hace que los mensajes que esa persona escriba desde su celular
            queden a su nombre en la ficha del cliente.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                run(async () => {
                  await createWaLine({ name, memberId, phone });
                  setName("");
                  setPhone("");
                  setMemberId("");
                  setAdding(false);
                })
              }
              disabled={busy || !name.trim()}
              className="px-5 py-2 bg-[#C41D16] text-white font-display font-bold text-xs tracking-widest uppercase rounded-sm hover:bg-[#E8231A] disabled:opacity-40 transition-colors"
            >
              {busy ? "Creando…" : "Crear"}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-4 py-2 text-[13px] font-semibold text-[#8A8A8A] hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {lines.map((l) => {
          const state = l.conn_state ? STATE_STYLE[l.conn_state] : null;
          const owner = members.find((m) => m.user_id === l.member_id);
          const showingQr = qr?.lineId === l.id;

          return (
            <div key={l.id} className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-semibold text-white">{l.name}</p>
                    <span
                      className={`px-2 py-0.5 text-[12px] font-bold tracking-wider uppercase border rounded-sm ${
                        l.kind === "meta"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                      }`}
                    >
                      {l.kind === "meta" ? "Oficial · Meta" : "Vendedor · Baileys"}
                    </span>
                    {state && (
                      <span
                        className={`px-2 py-0.5 text-[12px] font-bold tracking-wider uppercase border rounded-sm ${state.className}`}
                      >
                        {state.label}
                      </span>
                    )}
                    {!l.active && <span className="text-[12px] text-[#8A8A8A]">inactiva</span>}
                  </div>
                  <p className="text-[13px] text-[#8A8A8A] mt-1">
                    {l.phone ? formatArPhone(l.phone) : "sin número cargado"}
                    {owner && ` · ${owner.email}`}
                    {l.instance && ` · ${l.instance}`}
                  </p>
                  <p className="text-[13px] text-[#8A8A8A] mt-0.5">
                    Último mensaje {when(l.last_message_at)} · estado consultado{" "}
                    {when(l.conn_checked_at)}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-[13px] shrink-0">
                  {l.kind === "baileys" && (
                    <>
                      <button
                        onClick={() =>
                          run(async () => {
                            const data = await getLineQr(l.id);
                            setQr({ lineId: l.id, data });
                          })
                        }
                        disabled={busy}
                        className="text-green-400 hover:text-green-300 font-display font-semibold"
                      >
                        {l.conn_state === "open" ? "Volver a vincular" : "Vincular teléfono"}
                      </button>
                      {l.conn_state === "open" && (
                        <button
                          onClick={() => run(() => disconnectWaLine(l.id))}
                          className="text-[#8A8A8A] hover:text-white"
                        >
                          Desconectar
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => run(() => updateWaLine(l.id, { active: !l.active }))}
                    className="text-[#8A8A8A] hover:text-white"
                  >
                    {l.active ? "Pausar" : "Reactivar"}
                  </button>
                  {!l.is_primary &&
                    (confirmDelete === l.id ? (
                      <>
                        <button
                          onClick={() =>
                            run(async () => {
                              await deleteWaLine(l.id);
                              setConfirmDelete(null);
                            })
                          }
                          className="text-[#FF6A5C] hover:text-white font-display font-semibold"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-[#8A8A8A] hover:text-white"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(l.id)}
                        className="text-[#8A8A8A] hover:text-[#FF6A5C]"
                      >
                        Eliminar
                      </button>
                    ))}
                </div>
              </div>

              {showingQr && (
                <div className="mt-4 pt-4 border-t border-[#2A2A2E]">
                  {qr.data.base64 ? (
                    <div className="flex items-start gap-5 flex-wrap">
                      <Image
                        src={qr.data.base64}
                        alt="Código QR para vincular la línea"
                        width={220}
                        height={220}
                        unoptimized
                        className="bg-white p-2 rounded-sm"
                      />
                      <div className="text-[13px] text-[#B0B0B0] space-y-1.5 max-w-sm">
                        <p className="font-display font-semibold text-white">
                          En el teléfono de {l.name}:
                        </p>
                        <p>WhatsApp → Ajustes → Dispositivos vinculados → Vincular dispositivo.</p>
                        <p className="text-[#8A8A8A]">
                          El QR dura menos de un minuto. Si vence, apretá &quot;Vincular
                          teléfono&quot; de nuevo.
                        </p>
                        {qr.data.pairingCode && (
                          <p>
                            Si no puede escanear, el código es{" "}
                            <span className="font-mono text-white">{qr.data.pairingCode}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Hay versiones de Evolution donde este endpoint devuelve
                    // vacío aunque el Manager sí muestre el QR. Se dice, en vez
                    // de dejar la pantalla girando.
                    <div className="text-[13px] text-[#B0B0B0] space-y-2">
                      <p>
                        Evolution respondió sin código QR. Es un problema conocido de algunas
                        versiones: el QR existe, pero no viene por la API.
                      </p>
                      {managerUrl && (
                        <p>
                          Vinculala desde el Manager:{" "}
                          <a
                            href={`${managerUrl}/manager/instance/${l.instance}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white underline underline-offset-4"
                          >
                            abrir {l.instance}
                          </a>
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setQr(null)}
                    className="mt-3 text-[13px] text-[#8A8A8A] hover:text-white"
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
