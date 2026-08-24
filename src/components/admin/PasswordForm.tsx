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
  // En invitación y recuperación se entra al panel al terminar. Sin este paso
  // el salto es instantáneo y nunca se ve una confirmación: quedaba la duda de
  // si la contraseña se guardó o no.
  const [entering, setEntering] = useState(false);

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
        // Un respiro para que se vea la confirmación antes de saltar al panel.
        setEntering(true);
        setTimeout(() => {
          router.push("/admin/dashboard");
          router.refresh();
        }, 1400);
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
        Campo de usuario para los gestores de contraseñas. Oculto a propósito:
        es el patrón que documentan Chrome y MDN para los formularios de
        contraseña nueva. Sin ningún campo de usuario, el gestor no tiene a qué
        asociar la clave que genere y lee el formulario como un login (Dashlane
        mostraba "Ingresar como" con las cuentas guardadas). Y visible es peor:
        un campo de email a la vista es justamente la forma de un login, así que
        invita al mismo comportamiento que queremos evitar.

        La casilla igual se ve, acá abajo, como texto. Ver docs/ACCESOS.md.
      */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />

      <div>
        <label className={labelCls}>
          {mode === "invite" ? "Vas a entrar con" : mode === "reset" ? "La cuenta es" : "Tu cuenta"}
        </label>
        <div className="w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-4 py-3 text-white text-sm break-all">
          {email}
        </div>
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
      {(done || entering) && (
        <p className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-sm px-3 py-2">
          {entering
            ? "✓ Contraseña guardada. Entrando al panel..."
            : "✓ Listo, tu contraseña quedó cambiada."}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || entering}
        className="w-full py-3 bg-[#E8231A] text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-[#C41D16] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {entering
          ? "Entrando al panel..."
          : submitting
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
