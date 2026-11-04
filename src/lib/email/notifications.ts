/**
 * Correos de los formularios de garantía y revendedores. Vienen de
 * LatinOfficeWEB (`src/lib/email/notifications.ts`), con la marca FORCOM.
 *
 * Son "best-effort": el registro ya quedó guardado en la base y se ve en el
 * panel, así que si el correo no sale (Resend caído, dominio sin verificar) se
 * loguea y el formulario responde bien igual. Se mandan dentro de `after()`,
 * después de responderle a la persona.
 *
 * Destino de los avisos internos: RESEND_TO_EMAIL, el mismo del formulario de
 * contacto (hoy ventas@forcom.tech, decidido el 04/11/2026).
 *
 * Server-only.
 */
import { sendEmail, type SendEmailOptions } from "@/lib/email/send";
import { emailLayout, p, note, dataBox, esc } from "@/lib/email/layout";
import type { ResellerRequest, Warranty } from "@/lib/types";

const DEFAULT_TEAM_EMAIL = "ventas@forcom.tech";

/** Casilla del equipo: recibe los avisos y las respuestas de los clientes. */
function teamEmail(): string {
  return process.env.RESEND_TO_EMAIL?.trim() || DEFAULT_TEAM_EMAIL;
}

function dmy(isoDate: string) {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Tabla de datos en HTML y en texto, con el mismo contenido. */
function rows(pairs: Array<[string, string | null | undefined]>) {
  const filled = pairs.filter(([, v]) => v && String(v).trim() !== "") as Array<[string, string]>;
  const html = filled.map(([k, v]) => dataBox(esc(k), esc(v).replace(/\n/g, "<br />"))).join("\n");
  const text = filled.map(([k, v]) => `${(k + ":").padEnd(20)} ${v}`).join("\n");
  return { html, text };
}

async function safeSend(kind: string, opts: SendEmailOptions) {
  try {
    await sendEmail(opts);
  } catch (err) {
    console.error(`correo ${kind} no salió:`, err instanceof Error ? err.message : err);
  }
}

// ─── Revendedores ────────────────────────────────────────────────────────────

export async function notifyReseller(
  m: Omit<ResellerRequest, "id" | "status" | "admin_notes" | "created_at" | "updated_at">
) {
  const r = rows([
    ["Nombre", m.name],
    ["Empresa", m.company],
    ["Provincia", m.province],
    ["WhatsApp", `+${m.phone}`],
    ["Rubro de sus clientes", m.business_type],
    ["Comentarios", m.message],
  ]);
  await safeSend("revendedor", {
    to: teamEmail(),
    subject: `[Web FORCOM] Nuevo revendedor: ${m.company} (${m.province})`,
    html: emailLayout({
      preheader: `${m.company}, ${m.province}`,
      heading: "Pedido de alta de revendedor",
      bodyHtml: r.html + note("Quedó en el panel, en Revendedores."),
    }),
    text: `PEDIDO DE ALTA DE REVENDEDOR\n\n${r.text}\n\nQuedó en el panel, en Revendedores.`,
  });
}

// ─── Garantías ───────────────────────────────────────────────────────────────

type WarrantyData = Pick<
  Warranty,
  | "code" | "status" | "customer_name" | "customer_doc" | "email" | "phone" | "province" | "city"
  | "purchase_channel" | "store_name" | "product_name" | "quantity" | "invoice_number" | "invoice_date" | "expires_on"
>;

function warrantyRows(w: WarrantyData) {
  return rows([
    ["Código", w.code],
    ["Estado", w.status === "activa" ? "Activa" : w.status === "pendiente" ? "Pendiente de validación" : "Rechazada"],
    ["Vigente hasta", dmy(w.expires_on)],
    ["Titular", w.customer_name],
    ["DNI/CUIT", w.customer_doc],
    ["Email", w.email],
    ["Teléfono", `+${w.phone}`],
    ["Localidad", `${w.city}, ${w.province}`],
    ["Equipo", `${w.product_name} × ${w.quantity}`],
    ["N.º factura", w.invoice_number],
    ["Fecha factura", dmy(w.invoice_date)],
    ["Compra en", w.purchase_channel === "comercio" ? `Comercio o revendedor: ${w.store_name ?? ""}` : "Directo a FORCOM"],
  ]);
}

export async function notifyWarranty(w: WarrantyData, invoice: { filename: string; content: Buffer } | null) {
  const r = warrantyRows(w);
  const estado = w.status === "pendiente" ? "PENDIENTE DE VALIDACIÓN" : "ACTIVA";
  await safeSend("garantía interna", {
    to: teamEmail(),
    replyTo: w.email,
    subject: `[Garantía ${estado}] ${w.code} — ${w.product_name} — ${w.customer_name}`,
    html: emailLayout({
      preheader: `${w.code} · ${w.product_name} · ${w.customer_name}`,
      heading: w.status === "pendiente" ? "Garantía para validar" : "Garantía activada",
      bodyHtml:
        r.html +
        note(
          w.status === "pendiente"
            ? "Compró en un comercio: validá la factura con ese comercio y marcala como activa desde el panel, en Garantías."
            : "Compra directa: quedó activa sola. Está en el panel, en Garantías."
        ),
    }),
    text: `GARANTÍA ${estado}\n\n${r.text}`,
    attachments: invoice ? [invoice] : undefined,
  });
}

/** Comprobante para el cliente, al registrar. */
export async function sendWarrantyReceipt(w: WarrantyData) {
  const r = warrantyRows(w);
  const pendiente = w.status === "pendiente";
  const intro = pendiente
    ? "Recibimos el registro de garantía de tu equipo. Vamos a validar la factura con el comercio y te confirmamos la activación por este medio."
    : "La garantía de fábrica de 12 meses de tu equipo FORCOM quedó activada.";
  await safeSend("comprobante de garantía", {
    to: w.email,
    replyTo: teamEmail(),
    subject: `Tu garantía FORCOM — ${w.code}`,
    html: emailLayout({
      audience: "cliente",
      preheader: intro,
      heading: pendiente ? "Garantía registrada" : "Garantía activada",
      bodyHtml:
        p(`Hola ${esc(w.customer_name)},`) +
        p(esc(intro)) +
        r.html +
        note("Guardá este código: lo vas a necesitar ante cualquier consulta de servicio técnico. Si tenés dudas, respondé este correo."),
    }),
    text: `Hola ${w.customer_name},\n\n${intro}\n\n${r.text}\n\nGuardá este código: lo vas a necesitar ante cualquier consulta de servicio técnico. Si tenés dudas, respondé este correo.\n\nFORCOM · forcom.tech`,
  });
}

/** Aviso al cliente cuando el panel valida o rechaza una garantía. */
export async function sendWarrantyDecision(w: WarrantyData, motivo: string | null) {
  const activa = w.status === "activa";
  const intro = activa
    ? "Validamos tu factura: la garantía de fábrica de 12 meses de tu equipo FORCOM quedó activada."
    : "No pudimos validar tu factura con el comercio, así que la garantía no quedó activada.";
  const r = warrantyRows(w);
  await safeSend("decisión de garantía", {
    to: w.email,
    replyTo: teamEmail(),
    subject: activa ? `Tu garantía FORCOM está activa — ${w.code}` : `Tu garantía FORCOM — ${w.code}`,
    html: emailLayout({
      audience: "cliente",
      preheader: intro,
      heading: activa ? "Garantía activada" : "No pudimos validar la garantía",
      bodyHtml:
        p(`Hola ${esc(w.customer_name)},`) +
        p(esc(intro)) +
        (motivo ? p(esc(motivo)) : "") +
        (activa
          ? r.html + note("Si tenés dudas, respondé este correo.")
          : p("Si tenés dudas, respondé este correo o escribinos desde la web, en Contacto.")),
    }),
    text: `Hola ${w.customer_name},\n\n${intro}\n${motivo ? `\n${motivo}\n` : ""}\n${activa ? `${r.text}\n\nSi tenés dudas, respondé este correo.` : "Si tenés dudas, respondé este correo o escribinos desde la web, en Contacto."}\n\nFORCOM · forcom.tech`,
  });
}
