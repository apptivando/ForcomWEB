"use client";

/**
 * Paso 1 de "olvidé mi contraseña": pedir el link.
 *
 * El mensaje de éxito es siempre el mismo, exista o no la casilla. No es
 * pereza: si dijera "esa casilla no está registrada", el formulario sería una
 * forma cómoda de averiguar quién tiene acceso al panel. La server action
 * tampoco distingue.
 */

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/admin/actions";

export default function PasswordResetRequest({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      // La acción solo tira cuando el correo no sale para NADIE (dominio o
      // API key mal): ese mensaje se muestra tal cual, porque es lo único que
      // le permite a un admin darse cuenta de que hay que arreglar algo.
      setError(
        err instanceof Error && err.message
          ? `El correo no pudo salir: ${err.message}`
          : "No se pudo procesar el pedido. Probá de nuevo en un momento."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <>
        <h1 className="font-display font-bold text-xl text-white mb-3">Revisá tu correo</h1>
        <p className="text-[15px] text-[#8A8A8A] mb-4">
          Si <span className="text-white break-all">{email}</span> tiene acceso al panel, le
          acaba de llegar un link para elegir una contraseña nueva. Vale por una hora.
        </p>
        <p className="text-[15px] text-[#8A8A8A] mb-6">
          Si no lo ves, mirá en spam o en correo no deseado.
        </p>
        <Link href="/admin/login" className="inline-block text-[15px] text-[#FF6A5C] hover:underline">
          Volver al inicio de sesión
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display font-bold text-xl text-white mb-2">Recuperar contraseña</h1>
      <p className="text-[15px] text-[#8A8A8A] mb-6">
        Escribí tu casilla y te mandamos un link para elegir una nueva.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="username"
            className="w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-4 py-3 text-white placeholder:text-[#8A8A8A]/50 focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none transition-colors"
            placeholder="vos@empresa.com.ar"
          />
        </div>

        {error && (
          <p className="text-[15px] text-[#FF6A5C] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-[#C41D16] text-white font-display font-bold text-[15px] tracking-widest uppercase rounded-sm hover:bg-[#E8231A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Enviando..." : "Mandarme el link"}
        </button>
      </form>

      <p className="text-[15px] text-[#8A8A8A] mt-6">
        <Link href="/admin/login" className="text-[#FF6A5C] hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </>
  );
}
