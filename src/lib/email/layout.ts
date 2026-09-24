/**
 * Layout base de los correos transaccionales, con la identidad FORCOM.
 *
 * Reglas del medio (no son las del sitio):
 * - Todo con <table> y estilos inline. Gmail/Outlook tiran a la basura las
 *   hojas de estilo, flexbox y grid.
 * - Nada de imágenes para lo estructural: la mayoría de los clientes las
 *   bloquea por defecto y el correo tiene que leerse igual. La barra roja del
 *   logo es una celda con bgcolor, no un PNG.
 * - Barlow Condensed no existe en el correo (no hay webfonts confiables): se
 *   aproxima con Arial Narrow y cae a Arial. Mayúsculas + tracking hacen el
 *   resto del carácter de la marca.
 * - El ancho fijo es 600px, que es lo que entra en el panel de lectura de
 *   Outlook sin scroll horizontal.
 */

const BLACK = "#0D0D0F";
const CARD = "#141416";
const BORDER = "#2A2A2E";
const RED = "#E8231A";
const WHITE = "#FFFFFF";
const GRAY = "#8A8A8A";
const GRAY_LIGHT = "#B0B0B0";

const DISPLAY = "'Arial Narrow', Arial, Helvetica, sans-serif";
const BODY = "Arial, Helvetica, sans-serif";

export interface EmailLayoutOptions {
  /** Línea que el cliente de correo muestra como vista previa al lado del asunto. */
  preheader: string;
  /** Título dentro de la tarjeta. */
  heading: string;
  /** Cuerpo ya armado en HTML (usar los helpers `p()` / `note()`). */
  bodyHtml: string;
  /** Botón principal. Opcional: hay correos que no piden ninguna acción. */
  button?: { label: string; url: string };
  /** Texto chico bajo la línea del pie. */
  footerHtml?: string;
}

/** Párrafo del cuerpo. */
export function p(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${BODY};font-size:15px;line-height:1.6;color:${GRAY_LIGHT};">${html}</p>`;
}

/** Renglón chico y apagado, para aclaraciones. */
export function note(html: string): string {
  return `<p style="margin:0 0 12px;font-family:${BODY};font-size:13px;line-height:1.6;color:${GRAY};">${html}</p>`;
}

/** Dato destacado en su propia caja (ej. el email con el que se entra). */
export function dataBox(label: string, value: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
      <tr>
        <td style="background-color:${BLACK};border:1px solid ${BORDER};padding:14px 16px;">
          <div style="font-family:${DISPLAY};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${GRAY};padding-bottom:4px;">${label}</div>
          <div style="font-family:${BODY};font-size:15px;color:${WHITE};word-break:break-all;">${value}</div>
        </td>
      </tr>
    </table>`;
}

/** Escapa texto que venga de la base o del usuario antes de meterlo en el HTML. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailLayout({
  preheader,
  heading,
  bodyHtml,
  button,
  footerHtml,
}: EmailLayoutOptions): string {
  // El botón es una tabla con bgcolor (no un <a> con background-color): Outlook
  // en Windows renderiza con el motor de Word y descarta el fondo del <a>.
  const buttonHtml = button
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
        <tr>
          <td bgcolor="${RED}" style="border-radius:2px;">
            <a href="${esc(button.url)}"
               style="display:inline-block;padding:14px 32px;font-family:${DISPLAY};font-size:14px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${WHITE};text-decoration:none;">
              ${esc(button.label)}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px;font-family:${BODY};font-size:12px;line-height:1.5;color:${GRAY};">
        Si el botón no funciona, copiá y pegá esta dirección en el navegador:
      </p>
      <p style="margin:0 0 4px;font-family:${BODY};font-size:12px;line-height:1.5;color:${GRAY};word-break:break-all;">
        <a href="${esc(button.url)}" style="color:${RED};text-decoration:underline;">${esc(button.url)}</a>
      </p>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BLACK};">
  <!-- Preheader: se ve al lado del asunto en la bandeja, no dentro del correo. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${esc(preheader)}
    ${"&#847;&zwnj;&nbsp;".repeat(60)}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BLACK};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;">

          <!-- Marca -->
          <tr>
            <td style="padding:0 0 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="${RED}" width="8" style="width:8px;line-height:26px;font-size:0;">&nbsp;</td>
                  <td style="padding-left:10px;font-family:${DISPLAY};font-size:26px;font-weight:bold;letter-spacing:-0.5px;color:${WHITE};line-height:26px;">
                    FORCOM
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tarjeta -->
          <tr>
            <td style="background-color:${CARD};border:1px solid ${BORDER};padding:32px;">
              <h1 style="margin:0 0 20px;font-family:${DISPLAY};font-size:24px;font-weight:bold;color:${WHITE};line-height:1.25;">
                ${esc(heading)}
              </h1>
              ${bodyHtml}
              ${buttonHtml}
            </td>
          </tr>

          <!-- Pie -->
          <tr>
            <td style="padding:20px 4px 0;">
              ${
                footerHtml
                  ? `<p style="margin:0 0 10px;font-family:${BODY};font-size:12px;line-height:1.6;color:${GRAY};">${footerHtml}</p>`
                  : ""
              }
              <p style="margin:0;font-family:${BODY};font-size:12px;line-height:1.6;color:${GRAY};">
                Panel de administración de FORCOM · <a href="https://forcom.tech" style="color:${GRAY};text-decoration:underline;">forcom.tech</a><br />
                Correo automático — no hace falta responderlo.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
