"use client";

import { useState, useTransition } from "react";
import {
  inviteMember,
  cancelInvitation,
  resendInvitation,
  updateMemberRole,
  removeMember,
} from "@/app/admin/actions";
import { ROLE_LABEL } from "@/lib/auth/roles";
import type { AdminMember, AdminInvitation } from "@/lib/types";

/** "vence el 28 de agosto, 10:15" en hora de Argentina. */
function formatExpiry(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}

const inputCls =
  "w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-4 py-3 text-white focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none transition-colors";
const labelCls =
  "block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5";

export default function MembersEditor({
  members,
  invitations,
  emailByUserId,
  currentUserId,
}: {
  members: AdminMember[];
  invitations: AdminInvitation[];
  emailByUserId: Record<string, string>;
  currentUserId: string;
}) {
  const [, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminMember["role"]>("agent");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [resent, setResent] = useState<string | null>(null);

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);
    startTransition(async () => {
      try {
        await inviteMember(email, role);
        setEmail("");
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al invitar.");
      } finally {
        setSending(false);
      }
    });
  }

  function handleRoleChange(userId: string, newRole: AdminMember["role"]) {
    startTransition(async () => {
      try {
        await updateMemberRole(userId, newRole);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cambiar el rol.");
      }
    });
  }

  function handleRemove(userId: string) {
    if (!confirm("¿Quitar a este miembro del panel?")) return;
    startTransition(async () => {
      try {
        await removeMember(userId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al quitar el miembro.");
      }
    });
  }

  function handleResendInvitation(id: string) {
    setError("");
    setResending(id);
    startTransition(async () => {
      try {
        await resendInvitation(id);
        setResent(id);
        setTimeout(() => setResent(null), 4000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al reenviar la invitación.");
      } finally {
        setResending(null);
      }
    });
  }

  function handleCancelInvitation(id: string) {
    startTransition(async () => {
      try {
        await cancelInvitation(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cancelar la invitación.");
      }
    });
  }

  return (
    <div className="max-w-form space-y-6">
      {/* Invitar */}
      <form onSubmit={handleInvite} className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
        <h3 className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-4">
          Invitar a alguien
        </h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="email" className={labelCls}>Email</label>
            <input id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="persona@forcom.com.ar"
            />
          </div>
          <div>
            <label htmlFor="rol" className={labelCls}>Rol</label>
            <select id="rol"
              value={role}
              onChange={(e) => setRole(e.target.value as AdminMember["role"])}
              className={inputCls}
            >
              <option value="agent">Agente</option>
              <option value="admin">Admin</option>
              <option value="owner">Dueño</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={sending}
            className="px-6 py-3 bg-[#C41D16] text-white font-display font-bold text-[15px] tracking-widest uppercase rounded-sm hover:bg-[#E8231A] transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {sending ? "Enviando..." : "Invitar"}
          </button>
        </div>
        {sent && <p className="text-[15px] text-green-400 mt-3">✓ Invitación enviada</p>}
        {error && (
          <p className="text-[15px] text-[#FF6A5C] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3 mt-3">
            {error}
          </p>
        )}
      </form>

      {/* Invitaciones pendientes */}
      {invitations.length > 0 && (
        <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
          <h3 className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-4">
            Invitaciones pendientes
          </h3>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 py-2 border-b border-[#2A2A2E] last:border-0">
                <div className="min-w-0">
                  <p className="text-[15px] text-white truncate">{inv.email}</p>
                  <p className="text-[13px] text-[#8A8A8A]">
                    {ROLE_LABEL[inv.role]}
                    {" · "}
                    {new Date(inv.expires_at) < new Date()
                      ? "vencida"
                      : `vence el ${formatExpiry(inv.expires_at)}`}
                  </p>
                  {resent === inv.id && (
                    <p className="text-[13px] text-green-400 mt-0.5">
                      ✓ Correo reenviado con un link nuevo
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => handleResendInvitation(inv.id)}
                    disabled={resending === inv.id}
                    className="text-[13px] text-[#8A8A8A] hover:text-white transition-colors disabled:opacity-50"
                  >
                    {resending === inv.id ? "Enviando..." : "Reenviar"}
                  </button>
                  <button
                    onClick={() => handleCancelInvitation(inv.id)}
                    className="text-[13px] text-[#8A8A8A] hover:text-[#FF6A5C] transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Miembros actuales */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
        <h3 className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-4">
          Miembros ({members.length})
        </h3>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between py-2 border-b border-[#2A2A2E] last:border-0">
              <div>
                <p className="text-[15px] text-white">
                  {emailByUserId[m.user_id] ?? m.user_id}
                  {m.user_id === currentUserId && (
                    <span className="text-[#8A8A8A]"> (vos)</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={m.role}
                  onChange={(e) => handleRoleChange(m.user_id, e.target.value as AdminMember["role"])}
                  disabled={m.user_id === currentUserId}
                  className="bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-2 py-1.5 text-[13px] text-white focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none disabled:opacity-50"
                >
                  <option value="agent">Agente</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Dueño</option>
                </select>
                {m.user_id !== currentUserId && (
                  <button
                    onClick={() => handleRemove(m.user_id)}
                    className="text-[13px] text-[#8A8A8A] hover:text-[#FF6A5C] transition-colors"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
