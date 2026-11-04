import { after } from "next/server";
import { createCredentialsClient } from "@/lib/supabase/admin";
import { toWhatsappNumber } from "@/lib/phone";
import { spamReason } from "@/lib/antispam";
import { PROVINCES, RESELLER_TYPES } from "@/lib/site-forms";
import { PHONE_ERROR, SAVE_ERROR, clean, fail, ok } from "@/lib/forms";
import { notifyReseller } from "@/lib/email/notifications";

/**
 * "Sumate como revendedor". Portada de LatinOfficeWEB (`api/revendedores`).
 *
 * Inserta con la clave anon y SIN `.select()`: la policy deja insertar pero no
 * leer, y Postgres aplica la de SELECT al RETURNING (mismo caso que
 * /api/contact, ver CLAUDE.md).
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail("Formulario inválido.");
  }

  const rejected = spamReason(body);
  if (rejected) {
    console.warn(`revendedor descartado (${rejected})`);
    return ok();
  }

  const name = clean(body.nombre, 120);
  const company = clean(body.empresa, 160);
  const province = clean(body.prov, 60);
  const phoneRaw = clean(body.tel, 60);
  const typeRaw = clean(body.rubro, 80);
  const message = clean(body.msg, 4000) || null;

  if (!name || !company || !province || !phoneRaw) return fail("Completá nombre, empresa, provincia y WhatsApp.");
  if (!(PROVINCES as readonly string[]).includes(province)) return fail("Elegí la provincia de la lista.");
  const phone = toWhatsappNumber(phoneRaw);
  if (!phone) return fail(PHONE_ERROR);
  const business_type = (RESELLER_TYPES as readonly string[]).includes(typeRaw) ? typeRaw : null;

  const row = { name, company, province, phone, business_type, message, status: "nuevo" as const };
  const { error } = await createCredentialsClient().from("reseller_requests").insert(row);
  if (error) {
    console.error("reseller_requests insert:", error.code, error.message);
    return fail(SAVE_ERROR, 500);
  }

  after(() => notifyReseller(row));
  return ok();
}
