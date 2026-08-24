/**
 * Correo de recuperación de contraseña, en español y con la identidad FORCOM.
 *
 * El tono es distinto al de la invitación a propósito: acá el correo puede
 * haberlo disparado otra persona escribiendo la casilla ajena en el
 * formulario, así que tiene que quedar claro que **no hacer nada es seguro**.
 */

import { emailLayout, p, note, dataBox, esc } from "@/lib/email/layout";

export interface PasswordResetEmailInput {
  email: string;
  /** Link a /admin/recuperar con el token. */
  url: string;
  /** ISO. Se muestra en hora de Argentina. */
  expiresAt: string;
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}

export function passwordResetEmail({
  email,
  url,
  expiresAt,
}: PasswordResetEmailInput): { subject: string; html: string; text: string } {
  const hora = formatTime(expiresAt);

  const html = emailLayout({
    preheader: "Elegí una contraseña nueva para el panel de FORCOM. El link vale una hora.",
    heading: "Recuperar tu contraseña",
    bodyHtml: [
      p("Pediste volver a entrar al panel de administración de FORCOM. Elegí una contraseña nueva:"),
      dataBox("La cuenta es", esc(email)),
      note(
        `El link vale hasta las <strong style="color:#B0B0B0;">${esc(
          hora
        )}</strong> (una hora) y se puede usar una sola vez.`
      ),
    ].join("\n"),
    button: { label: "Elegir contraseña nueva", url },
    footerHtml:
      "Si no pediste esto, no hagas nada: tu contraseña actual sigue funcionando y este link se vence solo.",
  });

  const text = [
    "RECUPERAR TU CONTRASEÑA — PANEL DE FORCOM",
    "",
    "Pediste volver a entrar al panel de administración de FORCOM.",
    "",
    `La cuenta es: ${email}`,
    "",
    "Elegí una contraseña nueva acá:",
    url,
    "",
    `El link vale hasta las ${hora} (una hora) y se puede usar una sola vez.`,
    "",
    "Si no pediste esto, no hagas nada: tu contraseña actual sigue funcionando y este link se vence solo.",
    "",
    "— Panel de administración de FORCOM · forcom.tech",
    "Correo automático, no hace falta responderlo.",
  ].join("\n");

  return { subject: "Recuperar tu contraseña del panel de FORCOM", html, text };
}
