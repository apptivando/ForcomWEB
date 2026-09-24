/**
 * Aceptar una invitación al panel.
 *
 * Server component a propósito: valida el token contra la base antes de pintar
 * nada, y esa validación es de solo lectura — abrir esta página no consume la
 * invitación. Eso es lo que arregla el bug del flujo anterior, donde el
 * antivirus de la casilla abría el link y quemaba el token de Supabase antes
 * de que la persona lo viera (ver 015_invitaciones_propias.sql).
 */

import Link from "next/link";
import { lookupInvitation } from "@/lib/auth/invitations";
import { ROLE_LABEL } from "@/lib/auth/roles";
import AuthShell from "@/components/admin/AuthShell";
import PasswordForm from "@/components/admin/PasswordForm";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function Problema({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <>
      <h1 className="font-display font-bold text-xl text-white mb-3">{titulo}</h1>
      <p className="text-[15px] text-[#8A8A8A] mb-6">{detalle}</p>
      <Link
        href="/admin/login"
        className="inline-block text-[15px] text-[#FF6A5C] hover:underline"
      >
        Ir al inicio de sesión
      </Link>
    </>
  );
}

export default async function JoinPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const invitation = await lookupInvitation(raw ?? "");

  if (invitation.status === "expired") {
    return (
      <AuthShell subtitle="Invitación vencida">
        <Problema
          titulo="La invitación venció"
          detalle={`El link para ${invitation.email} ya no sirve. Pedile a un administrador que te la mande de nuevo desde Miembros — te va a llegar un correo con un link nuevo.`}
        />
      </AuthShell>
    );
  }

  if (invitation.status === "used") {
    return (
      <AuthShell subtitle="Invitación ya usada">
        <Problema
          titulo="Esta invitación ya se usó"
          detalle={`La cuenta de ${invitation.email} ya está creada. Entrá con tu email y tu contraseña.`}
        />
      </AuthShell>
    );
  }

  if (invitation.status === "invalid") {
    return (
      <AuthShell subtitle="Link inválido">
        <Problema
          titulo="El link no es válido"
          detalle="Puede estar cortado por el correo: probá copiarlo entero y pegarlo en el navegador. Si sigue sin andar, pedile a un administrador una invitación nueva."
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle="Activar tu acceso">
      <h1 className="font-display font-bold text-xl text-white mb-2">Elegí tu contraseña</h1>
      <p className="text-[15px] text-[#8A8A8A] mb-6">
        Vas a entrar al panel como{" "}
        <span className="text-white">{ROLE_LABEL[invitation.role]}</span>.
      </p>
      <PasswordForm mode="invite" email={invitation.email} token={raw!} />
    </AuthShell>
  );
}
