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
import PasswordForm from "@/components/admin/PasswordForm";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function Shell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-2 h-6 bg-[#E8231A]" />
            <span className="font-display font-extrabold text-2xl tracking-tight text-white">
              FORCOM
            </span>
          </div>
          <p className="text-[#8A8A8A] text-sm">{subtitle}</p>
        </div>
        <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-8">{children}</div>
      </div>
    </div>
  );
}

function Problema({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <>
      <h1 className="font-display font-bold text-xl text-white mb-3">{titulo}</h1>
      <p className="text-sm text-[#8A8A8A] mb-6">{detalle}</p>
      <Link
        href="/admin/login"
        className="inline-block text-sm text-[#E8231A] hover:underline"
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
      <Shell subtitle="Invitación vencida">
        <Problema
          titulo="La invitación venció"
          detalle={`El link para ${invitation.email} ya no sirve. Pedile a un administrador que te la mande de nuevo desde Miembros — te va a llegar un correo con un link nuevo.`}
        />
      </Shell>
    );
  }

  if (invitation.status === "used") {
    return (
      <Shell subtitle="Invitación ya usada">
        <Problema
          titulo="Esta invitación ya se usó"
          detalle={`La cuenta de ${invitation.email} ya está creada. Entrá con tu email y tu contraseña.`}
        />
      </Shell>
    );
  }

  if (invitation.status === "invalid") {
    return (
      <Shell subtitle="Link inválido">
        <Problema
          titulo="El link no es válido"
          detalle="Puede estar cortado por el correo: probá copiarlo entero y pegarlo en el navegador. Si sigue sin andar, pedile a un administrador una invitación nueva."
        />
      </Shell>
    );
  }

  return (
    <Shell subtitle="Activar tu acceso">
      <h1 className="font-display font-bold text-xl text-white mb-2">Elegí tu contraseña</h1>
      <p className="text-sm text-[#8A8A8A] mb-6">
        Vas a entrar al panel como{" "}
        <span className="text-white">{ROLE_LABEL[invitation.role]}</span>.
      </p>
      <PasswordForm mode="invite" email={invitation.email} token={raw!} />
    </Shell>
  );
}
