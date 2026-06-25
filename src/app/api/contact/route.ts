import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { name, company, email, industry, message } = body as Record<string, string>;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").insert({
    name: name.trim(),
    company: company?.trim() || null,
    email: email.trim().toLowerCase(),
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
      await resend.emails.send({
        from: `FORCOM Web <${process.env.RESEND_FROM_EMAIL ?? "noreply@forcom.com.ar"}>`,
        to: process.env.RESEND_TO_EMAIL ?? "ventas@forcom.com.ar",
        subject: `Nuevo lead: ${name} — ${company ?? "sin empresa"}`,
        html: `
          <h2>Nuevo mensaje desde forcom.com.ar</h2>
          <p><strong>Nombre:</strong> ${name}</p>
          <p><strong>Empresa:</strong> ${company ?? "—"}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Industria:</strong> ${industry ?? "—"}</p>
          <hr/>
          <p>${message.replace(/\n/g, "<br/>")}</p>
        `,
      });
    } catch (emailError) {
      console.error("resend error (non-fatal):", emailError);
    }
  }

  return NextResponse.json({ ok: true });
}
