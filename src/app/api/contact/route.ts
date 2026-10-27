import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toWhatsappNumber } from "@/lib/phone";
import { spamReason } from "@/lib/antispam";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { name, company, email, phone, industry, message } = body as Record<string, string>;

  // Descarte anti-bot ANTES de tocar la base: el spam no llega a
  // `contact_messages`.
  //
  // Se responde `ok: true`, igual que un envío bueno, a propósito. Un mensaje
  // de error sería exactamente la señal que el bot necesita para ajustar el
  // ataque hasta pasar el filtro.
  const rejected = spamReason(body as Record<string, unknown>);
  if (rejected) {
    console.warn(`contact spam descartado (${rejected}):`, { name, email });
    return NextResponse.json({ ok: true });
  }

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  // Solo dígitos, sin `+` (ver `toWhatsappNumber`). Un teléfono que no se
  // puede normalizar no bloquea el envío: el lead se guarda igual, sin teléfono.
  const normalizedPhone = phone?.trim() ? toWhatsappNumber(phone) : null;

  // Insert con el cliente anon y SIN `.select()`. La policy de INSERT es
  // pública (migración 018), pero la de SELECT es solo para autenticados, y
  // Postgres aplica la de SELECT al RETURNING: pedir la fila de vuelta haría
  // fallar el insert con 42501. Acá no hace falta el id para nada.
  //
  // En `develop` esta ruta además crea la ficha del cliente en `crm_contacts`
  // (con la service key, y por eso sí pide el id). Eso es del CRM, que se mudó
  // a Apptivando CRM, y no viaja a `main`.
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
