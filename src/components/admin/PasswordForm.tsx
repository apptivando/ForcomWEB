"use client";

/**
 * Formulario de contraseña, compartido por los tres momentos en que se elige
 * una:
 *
 * - `mode="invite"`  → /admin/join, con el token de la invitación. No hay
 *                      sesión todavía; al terminar se entra solo.
 * - `mode="reset"`   → /admin/recuperar, con el token del link de "olvidé mi
 *                      contraseña". Igual que invite, pero sobre una cuenta
 *                      que ya existe.
 * - `mode="change"`  → /admin/cuenta, con sesión. Pide la contraseña actual.
 *
 * En los tres casos se muestra arriba, fija y no editable, la casilla a la que
 * queda asociada la contraseña: es el dato que la gente no tiene claro cuando
 * después le pide el login (y en la invitación puede no ser la casilla desde
 * la que están leyendo el correo).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { acceptInvitation, changeOwnPassword, resetPassword } from "@/app/admin/actions";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/auth/password";

const inputCls =
  "w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-4 py-3 pr-20 text-white placeholder:text-[#8A8A8A]/50 focus:border-[#E8231A] focus:outline-none transition-colors";
const labelCls =
  "block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2";

function PasswordInput({
  label,
  name,
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  label: string;
  /** También lo miran los gestores de contraseñas para entender el campo. */
  name: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={name} className={labelCls}>
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className={inputCls}
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-display font-semibold tracking-[0.1em] uppercase text-[#8A8A8A] hover:text-[#E8231A] transition-colors"
        >
          {visible ? "Ocultar" : "Ver"}
        </button>
      </div>
    </div>
  );
}

export default function PasswordForm({
  mode,
  email,
  token,
}: {
  mode: "invite" | "reset" | "change";
  email: string;
  token?: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone(false);

    const invalid = validatePassword(password);
    if (invalid) return setError(invalid);
    if (password !== confirm) return setError("Las dos contraseñas no coinciden.");

    setSubmitting(true);
    try {
      const supabase = createClient();

      if (mode === "invite" || mode === "reset") {
        if (mode === "invite") await acceptInvitation(token!, password);
        else await resetPassword(token!, password);

        // La cuenta ya quedó con esta contraseña: se entra en el momento, sin
        // pasar por el login.
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) {
          // Caso raro: la cuenta quedó bien pero el login falló. Mejor mandar
          // al login que dejar la pantalla colgada.
          router.push("/admin/login");
          return;
        }
        router.push("/admin/dashboard");
        router.refresh();
        return;
      }

      await changeOwnPassword(current, password);
      // Cambiar la contraseña puede invalidar la sesión actual (depende de la
      // config de Supabase): se renueva con la nueva para no quedar afuera.
      await supabase.auth.signInWithPassword({ email, password });
      setCurrent("");
      setPassword("");
      setConfirm("");
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la contraseña.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/*
        La casilla asociada — no editable, es la que después va en el login.

        Es un <input readOnly> y no un <div> por los gestores de contraseñas:
        sin un campo de usuario en el formulario, Dashlane/1Password/Chrome no
        tienen a qué asociar la contraseña nueva, leen "un campo de password
        suelto" como un login y ofrecen las claves guardadas en vez de generar
        una segura. Con `autocomplete="username"` acá y `new-password` abajo,
        el formulario queda leído como lo que es. Ver docs/ACCESOS.md.
      */}
      <div>
        <label htmlFor="password-form-email" className={labelCls}>
          {mode === "invite" ? "Vas a entrar con" : mode === "reset" ? "La cuenta es" : "Tu cuenta"}
        </label>
        <input
          id="password-form-email"
          name="email"
          type="email"
          value={email}
          readOnly
          autoComplete="username"
          className="w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-4 py-3 text-white text-sm cursor-default focus:outline-none focus:border-[#2A2A2E]"
        />
      </div>

      {mode === "change" && (
        <PasswordInput
          label="Contraseña actual"
          name="current-password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          autoFocus
        />
      )}

      <PasswordInput
        label={mode === "invite" ? "Contraseña" : "Contraseña nueva"}
        name="new-password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        autoFocus={mode !== "change"}
      />
      <PasswordInput
        label="Repetir la contraseña"
        name="confirm-password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />

      <p className="text-[11px] text-[#8A8A8A]">
        Mínimo {MIN_PASSWORD_LENGTH} caracteres.
      </p>

      {error && (
        <p className="text-sm text-[#E8231A] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-3 py-2">
          {error}
        </p>
      )}
      {done && (
        <p className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-sm px-3 py-2">
          ✓ Listo, tu contraseña quedó cambiada.
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-[#E8231A] text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-[#C41D16] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting
          ? "Guardando..."
          : mode === "invite"
            ? "Crear contraseña y entrar"
            : mode === "reset"
              ? "Guardar y entrar"
              : "Cambiar contraseña"}
      </button>
    </form>
  );
}
