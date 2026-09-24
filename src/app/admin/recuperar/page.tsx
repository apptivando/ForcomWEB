/**
 * "Olvidé mi contraseña", en una sola ruta y dos estados:
 *
 * - sin `?token=` → el formulario para pedir el link.
 * - con `?token=` → la pantalla para elegir la contraseña nueva.
 *
 * Igual que /admin/join: la validación del token es de solo lectura, así que
 * abrir el link (o que lo abra el antivirus de la casilla) no lo consume. Se
 * marca usado recién cuando llega la contraseña.
 */

import Link from "next/link";
import { lookupPasswordReset } from "@/lib/auth/password-resets";
import AuthShell from "@/components/admin/AuthShell";
import PasswordForm from "@/components/admin/PasswordForm";
import PasswordResetRequest from "@/components/admin/PasswordResetRequest";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function LinkVencido({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <>
      <h1 className="font-display font-bold text-xl text-white mb-3">{titulo}</h1>
      <p className="text-[15px] text-[#8A8A8A] mb-6">{detalle}</p>
      <div className="flex flex-col gap-2">
        <Link href="/admin/recuperar" className="text-[15px] text-[#FF6A5C] hover:underline">
          Pedir un link nuevo
        </Link>
        <Link href="/admin/login" className="text-[15px] text-[#8A8A8A] hover:text-white transition-colors">
          Volver al inicio de sesión
        </Link>
      </div>
    </>
  );
}

export default async function RecuperarPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const token = Array.isArray(sp.token) ? sp.token[0] : sp.token;

  if (!token) {
    // El login pasa el email ya tipeado para no hacerlo escribir de nuevo.
    const email = Array.isArray(sp.email) ? sp.email[0] : sp.email;
    return (
      <AuthShell subtitle="Panel de administración">
        <PasswordResetRequest initialEmail={email ?? ""} />
      </AuthShell>
    );
  }

  const reset = await lookupPasswordReset(token);

  if (reset.status === "expired") {
    return (
      <AuthShell subtitle="Link vencido">
        <LinkVencido
          titulo="El link venció"
          detalle="Los links de recuperación duran una hora. Pedí uno nuevo y usalo apenas te llegue."
        />
      </AuthShell>
    );
  }

  if (reset.status === "used") {
    return (
      <AuthShell subtitle="Link ya usado">
        <LinkVencido
          titulo="Este link ya se usó"
          detalle="Tu contraseña ya se cambió con este link. Entrá con la nueva; si no la recordás, pedí otro link."
        />
      </AuthShell>
    );
  }

  if (reset.status === "invalid") {
    return (
      <AuthShell subtitle="Link inválido">
        <LinkVencido
          titulo="El link no es válido"
          detalle="Puede haber quedado cortado por el correo: probá copiarlo entero y pegarlo en el navegador. Si sigue sin andar, pedí uno nuevo."
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle="Recuperar contraseña">
      <h1 className="font-display font-bold text-xl text-white mb-2">Elegí una contraseña nueva</h1>
      <p className="text-[15px] text-[#8A8A8A] mb-6">
        Al guardarla entrás al panel directo.
      </p>
      <PasswordForm mode="reset" email={reset.email} token={token} />
    </AuthShell>
  );
}
