import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchAutoReply } from "@/lib/ai/auto-reply";
import { dispatchAutomations } from "@/lib/automations/engine";

// Webhook de entrada de Evolution API. El mismo servidor de Evolution
// atiende OTRAS instancias que no son de FORCOM ("onconcilia",
// "personal") — este endpoint filtra por `EVOLUTION_INSTANCE` y
// descarta en silencio cualquier evento que no sea el nuestro. Nunca
// tiene que llegar a tocar la base de datos con datos de otro proyecto.
//
// Sin sesión de usuario (llamada server-to-server) → usa la service
// role, no el cliente RLS-scoped.

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.EVOLUTION_WEBHOOK_TOKEN}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const event: string = body.event;
  const instance: string = body.instance;

  // El evento llega como "messages.upsert" (minúscula, con punto) —
  // no "MESSAGES_UPSERT" como en la doc/el registro del webhook.
  // Normalizamos para no depender de qué formato use Evolution.
  const normalizedEvent = event?.toUpperCase().replace(/\./g, "_");

  if (instance !== process.env.EVOLUTION_INSTANCE) {
    // Evento de otra instancia del mismo server Evolution — no es nuestro.
    return NextResponse.json({ ok: true });
  }

  if (normalizedEvent !== "MESSAGES_UPSERT") {
    // TODO: CONNECTION_UPDATE (estado open/close de la instancia) si
    // se quiere mostrar el estado de conexión en el panel.
    return NextResponse.json({ ok: true });
  }

  const data = body.data;
  if (data?.key?.fromMe) return NextResponse.json({ ok: true }); // eco de lo que mandamos nosotros
  // remoteJidAlt suele traer el número real cuando WhatsApp direcciona
  // por LID (addressingMode: "lid") — preferirlo cuando esté presente
  // (misma lección que en wacrm/Baileys).
  const jid: string = data?.key?.remoteJidAlt || data?.key?.remoteJid || "";
  if (!jid || jid.endsWith("@g.us")) return NextResponse.json({ ok: true }); // ignorar grupos

  const phone = jid.split("@")[0];
  const waMessageId: string | undefined = data.key.id;
  const name: string = data.pushName ?? phone;
  const { text, contentType } = extractContent(data);

  const supabase = createAdminClient();

  const { data: contact, error: contactErr } = await supabase
    .from("crm_contacts")
    .upsert({ phone, name }, { onConflict: "phone", ignoreDuplicates: false })
    .select("id")
    .single();
  if (contactErr) {
    console.error("[evolution webhook] contact upsert failed:", contactErr.message);
    return NextResponse.json({ ok: true }); // 200 igual — Evolution no debe reintentar por esto
  }

  let { data: conversation } = await supabase
    .from("crm_conversations")
    .select("id")
    .eq("contact_id", contact.id)
    .eq("status", "open")
    .maybeSingle();

  const isNewConversation = !conversation;
  if (!conversation) {
    const { data: created, error: convErr } = await supabase
      .from("crm_conversations")
      .insert({ contact_id: contact.id })
      .select("id")
      .single();
    if (convErr) {
      console.error("[evolution webhook] conversation insert failed:", convErr.message);
      return NextResponse.json({ ok: true });
    }
    conversation = created;
  }

  const { error: msgErr } = await supabase.from("crm_messages").insert({
    conversation_id: conversation.id,
    direction: "in",
    content_type: contentType,
    content_text: text || null,
    wa_message_id: waMessageId ?? null,
  });
  // Conflicto por wa_message_id repetido = reintento de Evolution, no es un error real.
  if (msgErr && msgErr.code !== "23505") {
    console.error("[evolution webhook] message insert failed:", msgErr.message);
  }

  await supabase
    .from("crm_conversations")
    .update({
      last_message_text: text || `[${contentType}]`,
      last_message_at: new Date(
        (data.messageTimestamp ? data.messageTimestamp * 1000 : Date.now())
      ).toISOString(),
    })
    .eq("id", conversation.id);

  // Se espera a que termine antes de responder — en un entorno
  // serverless, devolver 200 antes no garantiza que esto siga
  // corriendo. El costo es un webhook un poco más lento, aceptable
  // para el volumen de FORCOM.
  //
  // Automatizaciones primero, IA como respaldo — si una automatización
  // ya mandó algo, el auto-reply de IA no contesta encima (misma
  // prioridad que tenía wacrm).
  if (text) {
    const automationHandled = await dispatchAutomations(supabase, conversation.id, phone, text, isNewConversation);
    if (!automationHandled) {
      await dispatchAutoReply(conversation.id, phone);
    }
  }

  return NextResponse.json({ ok: true });
}

/** Extrae texto/tipo de los distintos tipos de mensaje de Baileys. */
function extractContent(data: {
  message?: Record<string, unknown>;
  messageType?: string;
}): { text: string; contentType: string } {
  const m = data.message ?? {};
  const contentType = data.messageType ?? Object.keys(m)[0] ?? "unknown";
  const text =
    (m.conversation as string | undefined) ??
    (m.extendedTextMessage as { text?: string } | undefined)?.text ??
    (m.imageMessage as { caption?: string } | undefined)?.caption ??
    (m.videoMessage as { caption?: string } | undefined)?.caption ??
    (m.documentMessage as { caption?: string } | undefined)?.caption ??
    "";
  return { text, contentType };
}
