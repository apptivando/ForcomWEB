"use client";

// Página que completa una invitación: Supabase ya autenticó a la
// persona (procesó el link del mail de invitación) antes de traerla
// acá — a veces vía un fragmento #access_token en la URL (que el
// cliente de Supabase detecta solo al iniciar), a veces vía ?code=
// (flujo PKCE, hay que canjearlo a mano). Cubrimos los dos casos
// porque no hay forma de confirmar cuál usa este proyecto sin probar
// un mail de invitación real — ver nota en el plan (Track E).
//
// Una vez hay sesión: pide una contraseña, la setea, y llama a
// acceptInvitation() para crear la fila en admin_members con el rol
// que le asignó quien invitó.

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { acceptInvitation } from "@/app/admin/actions";

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinPageInner />
    </Suspense>
  );
}

function JoinPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function resolveSession() {
      const code = searchParams.get("code");
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          setStatus("invalid");
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      setStatus(session ? "ready" : "invalid");
    }

    resolveSession();
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("La contraseña tiene que tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) throw new Error(pwErr.message);

      await acceptInvitation();

      router.push("/admin/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al completar la invitación.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-2 h-6 bg-[#E8231A]" />
            <span className="font-display font-extrabold text-2xl tracking-tight text-white">
              FORCOM
            </span>
          </div>
          <p className="text-[#8A8A8A] text-sm">Aceptar invitación</p>
        </div>

        <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-8">
          {status === "checking" && (
            <p className="text-sm text-[#8A8A8A]">Verificando invitación...</p>
          )}

          {status === "invalid" && (
            <>
              <h1 className="font-display font-bold text-xl text-white mb-3">
                Link inválido o vencido
              </h1>
              <p className="text-sm text-[#8A8A8A]">
                Pedile a quien te invitó que te mande una invitación nueva.
              </p>
            </>
          )}

          {status === "ready" && (
            <>
              <h1 className="font-display font-bold text-xl text-white mb-6">
                Elegí tu contraseña
              </h1>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-4 py-3 text-white placeholder:text-[#8A8A8A]/50 focus:border-[#E8231A] focus:outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">
                    Confirmar contraseña
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-4 py-3 text-white placeholder:text-[#8A8A8A]/50 focus:border-[#E8231A] focus:outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <p className="text-sm text-[#E8231A] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-[#E8231A] text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-[#C41D16] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Entrando..." : "Entrar al panel"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
