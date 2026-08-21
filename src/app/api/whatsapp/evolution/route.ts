import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchAutoReply } from "@/lib/ai/auto-reply";
import { dispatchAutomations } from "@/lib/automations/engine";

// Webhook de entrada de Evolution API.
//
// El mismo servidor de Evolution atiende OTRAS instancias que no son de FORCOM
// ("onconcilia", "personal"), así que lo primero es resolver a qué línea
// pertenece el evento: si la instancia no está registrada en `wa_lines`, se
// descarta en silencio. Nunca tiene que llegar a tocar la base con datos de
// otro proyecto.
//
// Sin sesión de usuario (llamada server-to-server) → usa la service role, no
// el cliente RLS-scoped.

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

  const supabase = createAdminClient();
  const line = await resolveLine(supabase, instance);
  if (!line) return NextResponse.json({ ok: true }); // instancia ajena

  if (normalizedEvent === "CONNECTION_UPDATE") {
    // Para que la pantalla de Líneas muestre si el teléfono se desconectó sin
    // tener que preguntarle a Evolution en cada carga.
    await supabase
      .from("wa_lines")
      .update({ conn_state: body.data?.state ?? null, conn_checked_at: new Date().toISOString() })
      .eq("id", line.id);
    return NextResponse.json({ ok: true });
  }

  if (normalizedEvent !== "MESSAGES_UPSERT") {
    return NextResponse.json({ ok: true });
  }

  const data = body.data;

  // remoteJidAlt suele traer el número real cuando WhatsApp direcciona
  // por LID (addressingMode: "lid") — preferirlo cuando esté presente
  // (misma lección que en wacrm/Baileys). Vale igual para los mensajes
  // salientes desde el teléfono, que también llegan con @lid.
  const jid: string = data?.key?.remoteJidAlt || data?.key?.remoteJid || "";
  if (!jid || jid.endsWith("@g.us")) return NextResponse.json({ ok: true }); // ignorar grupos

  /**
   * `fromMe` ya NO se descarta.
   *
   * Antes había un `return` acá que tiraba todo lo saliente, con el comentario
   * "eco de lo que mandamos nosotros". Pero ahí venían mezcladas dos cosas muy
   * distintas: el eco de lo que mandó la plataforma (que efectivamente ya está
   * guardado) y **lo que una persona escribió desde su celular** — que es
   * justamente lo que se pierde todos los días y lo que queremos registrar.
   *
   * Distinguirlas no hace falta: `crm_messages.wa_message_id` es UNIQUE desde
   * la migración 002, así que el eco choca contra ese índice y se descarta
   * solo. La idempotencia estaba construida desde el principio.
   */
  const fromMe: boolean = Boolean(data?.key?.fromMe);
  const direction = fromMe ? "out" : "in";

  const phone = jid.split("@")[0];
  const waMessageId: string | undefined = data.key.id;
  // El pushName de un mensaje saliente es el nombre de NUESTRO perfil, no el
  // del cliente. Usarlo sería ponerle a la ficha el nombre del vendedor.
  const name: string = fromMe ? phone : (data.pushName ?? phone);
  const { text, contentType } = extractContent(data);

  // Un número marcado como personal no se registra más, ni siquiera para
  // volver a crear la ficha que se acaba de purgar.
  const { data: excluded } = await supabase
    .from("wa_excluded_numbers")
    .select("phone")
    .eq("phone", phone)
    .maybeSingle();
  if (excluded) return NextResponse.json({ ok: true });

  // Desde la migración 010, `crm_contacts` es la tabla única de clientes y
  // guarda los dos nombres por separado: `contact_name` es la persona (esto,
  // el pushName de WhatsApp) y `business_name` la razón social (la carga el
  // scraper). `origin` queda fuera a propósito: si este número ya existía como
  // prospecto de una búsqueda, tiene que seguir figurando como tal. Para una
  // fila nueva, el DEFAULT de la columna la marca como 'whatsapp'.
  //
  // Y el nombre NO se pisa si ya hay uno. Antes esto era un upsert que
  // escribía `contact_name` en cada mensaje entrante, con la service key, sin
  // mirar `manual_lock`: cargabas "María González, compras" a mano y en cuanto
  // ella escribía desde un teléfono cuyo perfil dice "Mari 💅", se perdía. El
  // pushName es lo que la persona puso en SU WhatsApp, no cómo la conoce la
  // empresa.
  const contact = await upsertContactByPhone(supabase, phone, name, line.kind);
  if (!contact) return NextResponse.json({ ok: true }); // 200 igual — Evolution no debe reintentar

  // Una conversación abierta POR LÍNEA: si dos vendedores hablan con el mismo
  // cliente, cada uno tiene su hilo. Compartirlo mezclaría los mensajes de uno
  // con los del otro y haría ilegible el análisis.
  let { data: conversation } = await supabase
    .from("crm_conversations")
    .select("id")
    .eq("contact_id", contact.id)
    .eq("line_id", line.id)
    .eq("status", "open")
    .maybeSingle();

  const isNewConversation = !conversation;
  if (!conversation) {
    const { data: created, error: convErr } = await supabase
      .from("crm_conversations")
      .insert({ contact_id: contact.id, line_id: line.id })
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
    direction,
    content_type: contentType,
    content_text: text || null,
    wa_message_id: waMessageId ?? null,
    // Un mensaje que salió del celular de un vendedor lleva su nombre, para
    // que en la ficha del cliente se vea quién habló.
    sender_member_id: fromMe ? line.member_id : null,
  });
  // Conflicto por wa_message_id repetido: o es un reintento de Evolution, o es
  // el eco de un mensaje que la plataforma ya guardó al enviarlo. En los dos
  // casos no es un error — es la deduplicación funcionando.
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
  // Solo la línea oficial contesta sola, y solo a lo que entra. Que un
  // vendedor reciba un mensaje en su celular no puede disparar una respuesta
  // automática de la empresa desde otro número — el cliente vería dos
  // interlocutores distintos para la misma consulta.
  if (text && !fromMe && line.kind === "meta") {
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

/**
 * Encuentra o crea el cliente por su teléfono, sin pisarle el nombre.
 *
 * Un `upsert` de PostgREST no sirve para esto: escribe todas las columnas que
 * le pasás, siempre. Y no se puede resolver "solo si está vacío" del lado del
 * cliente sin leer primero. Por eso son dos pasos.
 *
 * La carrera —dos mensajes del mismo número nuevo llegando a la vez— se
 * resuelve dejando que la clave única de `phone` decida y releyendo: es más
 * simple y más correcto que intentar prevenirla.
 */
async function upsertContactByPhone(
  supabase: ReturnType<typeof createAdminClient>,
  phone: string,
  pushName: string,
  lineKind: string
): Promise<{ id: string } | null> {
  const { data: existing } = await supabase
    .from("crm_contacts")
    .select("id, contact_name")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    // Solo se completa si nadie puso un nombre antes.
    if (!existing.contact_name && pushName) {
      await supabase
        .from("crm_contacts")
        .update({ contact_name: pushName, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
    return { id: existing.id };
  }

  // El origen dice por dónde apareció el cliente por primera vez. Distinguir
  // 'vendedor' de 'whatsapp' importa: uno llegó por la línea oficial y el otro
  // apareció en el celular de alguien del equipo.
  const { data: created, error } = await supabase
    .from("crm_contacts")
    .insert({ phone, contact_name: pushName, origin: lineKind === "meta" ? "whatsapp" : "vendedor" })
    .select("id")
    .single();

  if (created) return created;

  // 23505 = otro pedido lo insertó entre nuestro SELECT y nuestro INSERT.
  if (error?.code === "23505") {
    const { data: raced } = await supabase
      .from("crm_contacts")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (raced) return raced;
  }

  console.error("[evolution webhook] no se pudo crear el contacto:", error?.message);
  return null;
}

interface WaLine {
  id: string;
  kind: string;
  member_id: string | null;
}

/**
 * A qué línea pertenece este evento.
 *
 * Antes se comparaba la instancia contra `EVOLUTION_INSTANCE` y listo. Ahora
 * hay varias líneas, así que se resuelve contra `wa_lines`. Lo que no cambia es
 * el criterio de fondo: **una instancia que no está registrada se descarta en
 * silencio**, porque el mismo servidor de Evolution atiende otros proyectos y
 * sus datos no tienen por qué entrar acá.
 *
 * El caso especial de abajo es lo que hace que la migración 013 no rompa nada:
 * la línea oficial se crea sin nombre de instancia (el SQL no puede leer una
 * variable de entorno) y se completa sola con el primer mensaje que llegue.
 */
async function resolveLine(
  supabase: ReturnType<typeof createAdminClient>,
  instance: string
): Promise<WaLine | null> {
  if (!instance) return null;

  const { data: known } = await supabase
    .from("wa_lines")
    .select("id, kind, member_id, active")
    .eq("instance", instance)
    .maybeSingle();

  if (known) return known.active ? known : null;

  // Adopción de la línea oficial: si la instancia es la del entorno y la línea
  // principal todavía no tiene instancia asignada, se la queda.
  if (instance === process.env.EVOLUTION_INSTANCE) {
    const { data: primary } = await supabase
      .from("wa_lines")
      .select("id, kind, member_id")
      .eq("is_primary", true)
      .is("instance", null)
      .maybeSingle();

    if (primary) {
      await supabase.from("wa_lines").update({ instance }).eq("id", primary.id);
      return primary;
    }
  }

  return null;
}
