"use client";

import { useState, useTransition } from "react";
import {
  inviteMember,
  cancelInvitation,
  updateMemberRole,
  removeMember,
} from "@/app/admin/actions";
import type { AdminMember, AdminInvitation } from "@/lib/types";

const ROLE_LABEL: Record<AdminMember["role"], string> = {
  owner: "Dueño",
  admin: "Admin",
  agent: "Agente",
};

const inputCls =
  "w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-4 py-3 text-white focus:border-[#E8231A] focus:outline-none transition-colors";
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
    <div className="max-w-2xl space-y-6">
      {/* Invitar */}
      <form onSubmit={handleInvite} className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
        <h3 className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-4">
          Invitar a alguien
        </h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <label className={labelCls}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="persona@forcom.com.ar"
            />
          </div>
          <div>
            <label className={labelCls}>Rol</label>
            <select
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
            className="px-6 py-3 bg-[#E8231A] text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-[#C41D16] transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {sending ? "Enviando..." : "Invitar"}
          </button>
        </div>
        {sent && <p className="text-sm text-green-400 mt-3">✓ Invitación enviada</p>}
        {error && (
          <p className="text-sm text-[#E8231A] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3 mt-3">
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
              <div key={inv.id} className="flex items-center justify-between py-2 border-b border-[#2A2A2E] last:border-0">
                <div>
                  <p className="text-sm text-white">{inv.email}</p>
                  <p className="text-[11px] text-[#8A8A8A]">{ROLE_LABEL[inv.role]}</p>
                </div>
                <button
                  onClick={() => handleCancelInvitation(inv.id)}
                  className="text-xs text-[#8A8A8A] hover:text-[#E8231A] transition-colors"
                >
                  Cancelar
                </button>
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
                <p className="text-sm text-white">
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
                  className="bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-2 py-1.5 text-xs text-white focus:border-[#E8231A] focus:outline-none disabled:opacity-50"
                >
                  <option value="agent">Agente</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Dueño</option>
                </select>
                {m.user_id !== currentUserId && (
                  <button
                    onClick={() => handleRemove(m.user_id)}
                    className="text-xs text-[#8A8A8A] hover:text-[#E8231A] transition-colors"
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
