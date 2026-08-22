/**
 * Envío de correo transaccional vía Resend.
 *
 * A diferencia del mail del formulario de contacto (`/api/contact`), que es
 * best-effort y se traga los errores, acá el envío es la razón de ser de la
 * operación: si la invitación no sale, quien invita tiene que enterarse. Por
 * eso esto tira en vez de loguear.
 *
 * Server-only: importa la API key. No importar desde un componente cliente.
 */

const DEFAULT_FROM_EMAIL = "noreply@forcom.tech";
const DEFAULT_FROM_NAME = "FORCOM";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  /** Versión en texto plano. Suma para llegar a la bandeja y no a spam. */
  text: string;
  /** Casilla real a la que puede contestar quien recibe, si la hay. */
  replyTo?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: SendEmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta RESEND_API_KEY — sin esa variable no se puede mandar correo."
    );
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM_EMAIL;
  const fromName = process.env.RESEND_FROM_NAME ?? DEFAULT_FROM_NAME;

  const { error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
    html,
    text,
    ...(replyTo ? { replyTo } : {}),
  });

  // El SDK de Resend no tira: devuelve { data, error }. Si no se mira, un
  // dominio sin verificar falla en silencio.
  if (error) {
    throw new Error(`Resend: ${error.message ?? "error desconocido"}`);
  }
}
