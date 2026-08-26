import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // Descarte anti-bot ANTES de tocar la base: el spam no tiene que llegar ni a
  // `contact_messages` ni, sobre todo, a `crm_contacts`.
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

  // Dígitos sin `+`, mismo formato que `crm_contacts.phone`. Antes se guardaba
  // con `+` y los dos formatos no matcheaban; la migración 010 normaliza las
  // filas viejas. Un teléfono que no se puede normalizar no bloquea el envío:
  // el lead se guarda igual, solo que sin teléfono.
  const normalizedPhone = phone?.trim() ? toWhatsappNumber(phone) : null;

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const cleanCompany = company?.trim() || null;

  // El mensaje se guarda con el cliente anon: `contact_messages` tiene una
  // policy de INSERT público justamente para esto (el formulario lo usa gente
  // sin sesión).
  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("contact_messages")
    .insert({
      name: cleanName,
      company: cleanCompany,
      email: cleanEmail,
      phone: normalizedPhone,
      industry: industry || null,
      message: message.trim(),
      status: "nuevo",
    })
    .select("id")
    .single();

  if (error) {
    console.error("contact insert error:", error);
    return NextResponse.json({ error: "Error al guardar el mensaje" }, { status: 500 });
  }

  // Fase 7 del Track E: además del mensaje, se crea (o se completa) la ficha
  // del cliente, así el lead aparece en /admin/clientes junto a los prospectos
  // y a los contactos de WhatsApp.
  //
  // Va con la service key y NO con el cliente anon: `crm_contacts` no tiene ni
  // debe tener una policy para anónimos — abrirla dejaría a cualquiera leer la
  // base de clientes entera desde el navegador. Con RLS activo y sin policy el
  // insert no daría error, simplemente no escribiría ninguna fila.
  //
  // Un fallo acá no rompe el formulario: el mensaje ya está guardado y el mail
  // de aviso se manda igual. Se loguea y se sigue.
  try {
    const admin = createAdminClient();
    let contactId: string | null = null;

    if (normalizedPhone) {
      // Con teléfono, la clave es el teléfono: es lo que comparte con el CRM
      // de WhatsApp. `origin` queda fuera del upsert a propósito — si este
      // número ya existía como prospecto o como contacto de WhatsApp, tiene
      // que seguir figurando con su origen original.
      const { data } = await admin
        .from("crm_contacts")
        .upsert(
          { phone: normalizedPhone, contact_name: cleanName },
          { onConflict: "phone", ignoreDuplicates: false }
        )
        .select("id, email, business_name, whatsapp_phone")
        .single();

      if (data) {
        contactId = data.id;
        const patch: Record<string, string> = {};
        if (!data.email) patch.email = cleanEmail;
        if (!data.business_name && cleanCompany) patch.business_name = cleanCompany;
        // El campo del formulario dice "Teléfono (WhatsApp)" y aclara que por
        // ahí lo vamos a contactar: es la propia persona declarando su
        // WhatsApp, evidencia más fuerte que cualquier cosa que saque el
        // enriquecedor. Sin esto, la Bandeja del formulario ofrecía
        // "Responder por WhatsApp" y la ficha del mismo cliente mostraba el
        // canal apagado.
        //
        // Solo si estaba vacío: un WhatsApp ya confirmado por otra vía (un
        // enlace wa.me en su sitio, por ejemplo) puede ser un número distinto
        // del que acaba de escribir, y ese no se pisa.
        if (!data.whatsapp_phone) {
          patch.whatsapp_phone = normalizedPhone;
          patch.whatsapp_source = "formulario";
        }
        if (Object.keys(patch).length > 0) {
          await admin.from("crm_contacts").update(patch).eq("id", data.id);
        }
      }
    } else {
      // Sin teléfono, la clave es el email. No hay UNIQUE sobre esa columna
      // (las cadenas comparten info@… entre sucursales), así que se busca
      // primero en vez de hacer upsert.
      const { data: existing } = await admin
        .from("crm_contacts")
        .select("id")
        .eq("email", cleanEmail)
        .limit(1)
        .maybeSingle();

      if (existing) {
        contactId = existing.id;
      } else {
        const { data: created } = await admin
          .from("crm_contacts")
          .insert({
            email: cleanEmail,
            contact_name: cleanName,
            business_name: cleanCompany,
            origin: "formulario",
            enrichment_status: "skipped",
          })
          .select("id")
          .single();
        contactId = created?.id ?? null;
      }
    }

    if (contactId && inserted?.id) {
      await admin.from("contact_messages").update({ contact_id: contactId }).eq("id", inserted.id);
    }
  } catch (crmError) {
    console.error("contact → crm_contacts error (non-fatal):", crmError);
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
