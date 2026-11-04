import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toWhatsappNumber } from "@/lib/phone";
import { spamReason } from "@/lib/antispam";
import { MAX_INVOICE_MB, PROVINCES } from "@/lib/site-forms";
import { EMAIL_RE, PHONE_ERROR, SAVE_ERROR, addOneYear, clean, fail, isIsoDate, ok, sniffInvoice, todayAR } from "@/lib/forms";
import { notifyWarranty, sendWarrantyReceipt } from "@/lib/email/notifications";

const BUCKET = "warranty-invoices";

/** FC-AAAA-XXXXXX, con 6 caracteres hex al azar (16,7 millones por año). */
function newCode() {
  return `FC-${todayAR().slice(0, 4)}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/**
 * Alta de garantía. Portada de LatinOfficeWEB (`api/garantia`), con las reglas
 * que confirmó el cliente el 04/11/2026:
 *
 * - 12 meses desde la fecha de la factura, para todos los productos.
 * - Compra directa a FORCOM → ACTIVA; la factura es opcional.
 * - Compra en un comercio o revendedor → PENDIENTE hasta que el equipo valide
 *   la factura con ese comercio; la factura es obligatoria.
 * - Se rechazan fechas futuras y garantías ya vencidas.
 *
 * A diferencia de /api/contact, va con la service role: sube la factura a un
 * bucket privado y valida el producto contra la tabla real.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Formulario inválido.");
  }

  const fields = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
  const rejected = spamReason(fields);
  if (rejected) {
    console.warn(`garantía descartada (${rejected})`);
    // Mismo formato que un alta buena, con un código que no existe.
    return ok({ codigo: newCode(), estado: "pendiente", vence: addOneYear(todayAR()) });
  }

  const channel = clean(fields.donde, 10) === "comercio" ? "comercio" : "directo";
  const d = {
    customer_name: clean(fields.nombre, 120),
    customer_doc: clean(fields.doc, 20),
    email: clean(fields.email, 160).toLowerCase(),
    phoneRaw: clean(fields.tel, 60),
    province: clean(fields.prov, 60),
    city: clean(fields.loc, 120),
    store_name: channel === "comercio" ? clean(fields.comercio, 160) : "",
    product_id: clean(fields.modelo, 40),
    quantity: Number.parseInt(clean(fields.cant, 5), 10),
    invoice_number: clean(fields.fac, 40),
    invoice_date: clean(fields.fecha, 10),
  };

  const required = [d.customer_name, d.customer_doc, d.phoneRaw, d.province, d.city, d.product_id, d.invoice_number, d.invoice_date];
  if (channel === "comercio") required.push(d.store_name);
  if (required.some((v) => !v)) return fail("Completá los campos marcados con *.");
  if (!EMAIL_RE.test(d.email)) return fail("Revisá el email: el formato no es válido.");
  if (!(PROVINCES as readonly string[]).includes(d.province)) return fail("Elegí la provincia de la lista.");
  if (!Number.isFinite(d.quantity) || d.quantity < 1 || d.quantity > 999) return fail("Revisá la cantidad de unidades.");
  const phone = toWhatsappNumber(d.phoneRaw);
  if (!phone) return fail(PHONE_ERROR);
  if (!isIsoDate(d.invoice_date)) return fail("La fecha de la factura no es válida.");

  const today = todayAR();
  const expires_on = addOneYear(d.invoice_date);
  if (d.invoice_date > today) return fail("La fecha de la factura no puede ser posterior a hoy.");
  if (expires_on < today) {
    return fail("Según la fecha de la factura, la garantía de 12 meses ya venció. Escribinos desde Contacto y lo revisamos.");
  }

  // Factura: tamaño y tipo real por sus primeros bytes.
  const file = form.get("factura");
  let invoice: { bytes: Buffer; mime: string; ext: string } | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_INVOICE_MB * 1024 * 1024) {
      return fail(`La factura supera los ${MAX_INVOICE_MB} MB. Subí una foto más liviana.`);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const kind = sniffInvoice(bytes);
    if (!kind) return fail("La factura tiene que ser una imagen (JPG, PNG, WEBP o HEIC) o un PDF.");
    invoice = { bytes, ...kind };
  } else if (channel === "comercio") {
    return fail("Adjuntá la foto o PDF de la factura para poder validarla con el comercio.");
  }

  const admin = createAdminClient();

  // El equipo se valida contra la lista real: cualquier producto activo.
  const { data: product, error: productErr } = await admin
    .from("products")
    .select("id, model, active")
    .eq("id", d.product_id)
    .maybeSingle();
  if (productErr) {
    console.error("garantía, producto:", productErr.message);
    return fail("Elegí el equipo de la lista.");
  }
  if (!product || !product.active) return fail("Elegí el equipo de la lista.");

  const status = channel === "comercio" ? "pendiente" : "activa";
  const base = {
    status,
    customer_name: d.customer_name,
    customer_doc: d.customer_doc,
    email: d.email,
    phone,
    province: d.province,
    city: d.city,
    purchase_channel: channel,
    store_name: channel === "comercio" ? d.store_name : null,
    product_name: product.model as string,
    product_id: product.id as string,
    quantity: d.quantity,
    invoice_number: d.invoice_number,
    invoice_date: d.invoice_date,
    expires_on,
  } as const;

  // Un choque de código es muy improbable, pero si pasa se reintenta.
  let code = "";
  let invoicePath: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    code = newCode();
    if (invoice) {
      invoicePath = `${today.slice(0, 4)}/${code}.${invoice.ext}`;
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(invoicePath, invoice.bytes, { contentType: invoice.mime, upsert: false });
      if (upErr) {
        console.error("garantía, subida de factura:", upErr.message);
        return fail("No pudimos subir la factura. Probá de nuevo o con otro archivo.", 500);
      }
    }
    const { error } = await admin.from("warranties").insert({ ...base, code, invoice_path: invoicePath });
    if (!error) break;
    if (invoicePath) await admin.storage.from(BUCKET).remove([invoicePath]);
    if (error.code !== "23505") {
      // 42P01 = falta correr la migración 024.
      console.error("warranties insert:", error.code, error.message);
      return fail(SAVE_ERROR, 500);
    }
    if (attempt === 2) return fail(SAVE_ERROR, 500);
  }

  const record = { ...base, code };
  after(async () => {
    await notifyWarranty(
      record,
      invoice ? { filename: `factura-${code}.${invoice.ext}`, content: invoice.bytes } : null
    );
    await sendWarrantyReceipt(record);
  });

  return ok({ codigo: code, estado: status, vence: expires_on });
}
