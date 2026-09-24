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

/**
 * Falla que no depende de a quién se le manda: falta la API key, el dominio
 * no está verificado, la key no tiene permiso. Se distingue del resto porque
 * es la única clase de error que se puede mostrar en pantalla sin filtrar si
 * la casilla del destinatario existe — y porque significa que NINGÚN correo
 * está saliendo, que es justo lo que no puede pasar en silencio.
 *
 * Pasó el 24/08/2026: el registro DKIM de forcom.tech desapareció del DNS,
 * Resend puso el dominio en "failed" y la recuperación de contraseña se
 * tragaba el error mostrando "revisá tu correo". Ver docs/ACCESOS.md.
 */
export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigError";
  }
}

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
    throw new EmailConfigError(
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
    const message = error.message ?? "error desconocido";
    // 401/403 y todo lo que hable de la key o del dominio es configuración:
    // el envío no habría salido para ningún destinatario.
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 401 || status === 403 || /not verified|api key|domain/i.test(message)) {
      throw new EmailConfigError(`Resend: ${message}`);
    }
    throw new Error(`Resend: ${message}`);
  }
}
