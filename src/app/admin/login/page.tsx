"use client";

import { useState, type FormEvent, Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const searchParams = useSearchParams();
  const [error, setError] = useState(
    searchParams.get("error") === "no-autorizado"
      ? "Tu cuenta no tiene acceso al panel. Pedile a un admin que te invite."
      : ""
  );
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Email o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-2 h-6 bg-[#E8231A]" />
            <span className="font-display font-extrabold text-2xl tracking-tight text-white">
              FORCOM
            </span>
          </div>
          <p className="text-[#8A8A8A] text-[15px]">Panel de administración</p>
        </div>

        <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-8">
          <h1 className="font-display font-bold text-xl text-white mb-6">
            Iniciar sesión
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#D4D4D4] mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-4 py-3 text-white placeholder:text-[#6A6A70] focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none transition-colors"
                placeholder="admin@forcom.com.ar"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#D4D4D4] mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-4 py-3 text-white placeholder:text-[#6A6A70] focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-[15px] text-[#FF6A5C] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#C41D16] text-white font-bold text-[16px] tracking-[0.3px] rounded-sm hover:bg-[#E8231A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>

            {/* Se lleva el email ya tipeado para no hacerlo escribir de nuevo. */}
            <p className="text-center text-[15px]">
              <Link
                href={`/admin/recuperar${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                className="text-[#A8A8A8] underline underline-offset-4 hover:text-[#FF6A5C] transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
