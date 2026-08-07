import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Normaliza un teléfono argentino a E.164 con el "9" de celular
 * (+549<área><número>), el formato que espera WhatsApp — es el mismo
 * que usa `crm_contacts.phone` del CRM propio (Track E), así que el
 * número queda listo para cuando ese inbox lo consuma.
 * Heurística best-effort — no hay forma determinística de saber dónde
 * termina el código de área sin una lista completa, así que cubre el
 * formato más común en Argentina (área + número directo, con o sin
 * +54, con o sin el 0 nacional) y devuelve null si el resultado no
 * tiene una longitud razonable. Un fallo acá no bloquea el envío del
 * formulario — solo significa que el lead queda guardado sin teléfono
 * normalizado.
 *
 * NO intenta detectar/sacar el viejo prefijo local "15" (ej. "011
 * 15-1234-5678") — se probó y el "15" aparece tan seguido por pura
 * coincidencia en el borde entre área y número (ej. área 351 + número
 * que empieza en 5 arma un "15" ahí que no es el prefijo) que hacía
 * más daño rompiendo números válidos que el que evitaba. Un número
 * escrito con el "15" explícito va a dar un resultado más largo de lo
 * esperado y termina devolviendo null (falla segura) en vez de un
 * número corrompido.
 */
function normalizeArgentinePhone(raw: string): string | null {
  let d = raw.replace(/[^\d]/g, "");
  if (!d) return null;

  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);

  const e164 = `549${d}`;
  if (e164.length < 12 || e164.length > 14) return null;
  return `+${e164}`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { name, company, email, phone, industry, message } = body as Record<string, string>;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const normalizedPhone = phone?.trim() ? normalizeArgentinePhone(phone) : null;

  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").insert({
    name: name.trim(),
    company: company?.trim() || null,
    email: email.trim().toLowerCase(),
    phone: normalizedPhone,
    industry: industry || null,
    message: message.trim(),
    status: "nuevo",
  });

  if (error) {
    console.error("contact insert error:", error);
    return NextResponse.json({ error: "Error al guardar el mensaje" }, { status: 500 });
  }

  // Envío de email via Resend (opcional — configurar RESEND_API_KEY en .env.local)
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = `FORCOM Web <${process.env.RESEND_FROM_EMAIL ?? "noreply@forcom.tech"}>`;

      await resend.emails.send({
        from,
        to: process.env.RESEND_TO_EMAIL ?? "ventas@forcom.tech",
        subject: `Nuevo lead: ${name} — ${company ?? "sin empresa"}`,
        html: `
          <h2>Nuevo mensaje desde forcom.tech</h2>
          <p><strong>Nombre:</strong> ${name}</p>
          <p><strong>Empresa:</strong> ${company ?? "—"}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Teléfono:</strong> ${normalizedPhone ?? "—"}</p>
          <p><strong>Industria:</strong> ${industry ?? "—"}</p>
          <hr/>
          <p>${message.replace(/\n/g, "<br/>")}</p>
        `,
      });

      await resend.emails.send({
        from,
        to: email,
        subject: "Recibimos tu consulta — FORCOM",
        html: `
          <p>Hola ${name},</p>
          <p>Gracias por contactarte con FORCOM. Recibimos tu mensaje y nos pondremos en contacto a la brevedad.</p>
          <hr/>
          <p style="color:#888;font-size:13px;">Este es un mensaje automático, por favor no respondas a este correo.<br/>
          Para consultas urgentes escribinos a <a href="mailto:ventas@forcom.tech">ventas@forcom.tech</a></p>
        `,
      });
    } catch (emailError) {
      console.error("resend error (non-fatal):", emailError);
    }
  }

  return NextResponse.json({ ok: true });
}
