/**
 * Correo de invitación al panel, en español y con la identidad FORCOM.
 *
 * Reemplaza al mail que mandaba Supabase (`inviteUserByEmail`), que era en
 * inglés, con el diseño de ellos y con un link que se quemaba solo — ver
 * `supabase/sql-changes/015_invitaciones_propias.sql`.
 */

import { ROLE_LABEL, type AdminRole } from "@/lib/auth/roles";
import { emailLayout, p, note, dataBox, esc } from "@/lib/email/layout";

export interface InvitationEmailInput {
  /** Casilla invitada — es también el usuario con el que va a entrar. */
  email: string;
  role: AdminRole;
  /** Link a /admin/join con el token. */
  url: string;
  /** ISO. Se muestra en hora de Argentina. */
  expiresAt: string;
  /** Email de quien invitó, si se pudo resolver. */
  invitedBy?: string | null;
  /** true si es un reenvío: cambia el asunto y aclara que el link viejo ya no sirve. */
  resent?: boolean;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    // 24 horas: con hour12 el es-AR devuelve "04:29 p. m.", y ese punto final
    // pegado al de la oración queda como "p. m..".
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}

export function invitationEmail({
  email,
  role,
  url,
  expiresAt,
  invitedBy,
  resent = false,
}: InvitationEmailInput): { subject: string; html: string; text: string } {
  const roleLabel = ROLE_LABEL[role];
  const vence = formatDate(expiresAt);
  const quien = invitedBy ?? "Un administrador";

  const intro = resent
    ? p(
        `Te mandamos de nuevo el acceso al panel de administración de FORCOM, con el rol de <strong style="color:#FFFFFF;">${esc(
          roleLabel
        )}</strong>. Este link reemplaza al anterior: el de antes ya no sirve.`
      )
    : p(
        `${esc(quien)} te habilitó para entrar al panel de administración de FORCOM con el rol de <strong style="color:#FFFFFF;">${esc(
          roleLabel
        )}</strong>.`
      );

  const html = emailLayout({
    preheader: `Creá tu contraseña para entrar al panel de FORCOM. El acceso queda a nombre de ${email}.`,
    heading: resent ? "Tu acceso al panel, de nuevo" : "Te dieron acceso al panel",
    bodyHtml: [
      intro,
      p("Para activarlo solo falta que elijas una contraseña:"),
      dataBox("Vas a entrar con esta dirección", esc(email)),
      note(`El link vence el <strong style="color:#B0B0B0;">${esc(vence)}</strong>.`),
    ].join("\n"),
    button: { label: "Crear mi contraseña", url },
    footerHtml:
      "Si no esperabas este correo, ignoralo: sin la contraseña no se activa ningún acceso.",
  });

  const text = [
    resent ? "TU ACCESO AL PANEL DE FORCOM, DE NUEVO" : "TE DIERON ACCESO AL PANEL DE FORCOM",
    "",
    resent
      ? `Te mandamos de nuevo el acceso al panel de administración de FORCOM, con el rol de ${roleLabel}. Este link reemplaza al anterior: el de antes ya no sirve.`
      : `${quien} te habilitó para entrar al panel de administración de FORCOM con el rol de ${roleLabel}.`,
    "",
    `Vas a entrar con esta dirección: ${email}`,
    "",
    "Para activarlo, elegí tu contraseña acá:",
    url,
    "",
    `El link vence el ${vence}. Si se te pasa, pedile a un administrador que te lo mande de nuevo.`,
    "",
    "Si no esperabas este correo, ignoralo: sin la contraseña no se activa ningún acceso.",
    "",
    "— Panel de administración de FORCOM · forcom.tech",
    "Correo automático, no hace falta responderlo.",
  ].join("\n");

  return {
    subject: resent
      ? "Tu acceso al panel de FORCOM (link nuevo)"
      : "Tu acceso al panel de FORCOM",
    html,
    text,
  };
}
