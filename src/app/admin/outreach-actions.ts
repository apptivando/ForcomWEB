"use server";

// Server Actions del contacto en frío: escribirle desde la plataforma a alguien
// que nunca nos escribió.
//
// Viven en su propio archivo y no en `actions.ts` porque ese ya pasó las 1.200
// líneas y esto es un dominio con reglas propias — la ventana de 24 h de Meta,
// el tope diario, las plantillas aprobadas. Ver `src/lib/outreach/index.ts`.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/roles";
import {
  getWindowState,
  renderTemplate,
  deliver,
  dailyColdLimit,
  currentTransport,
  OutreachBlocked,
  type WindowState,
  type OutreachTransport,
} from "@/lib/outreach";
import type { CrmContact, OutreachTemplate } from "@/lib/types";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return supabase;
}

// ─── Plantillas ──────────────────────────────────────────────────────────────

export async function listOutreachTemplates(): Promise<OutreachTemplate[]> {
  const supabase = await requireAuth();
  const { data, error } = await supabase
    .from("outreach_templates")
    .select("*")
    .order("active", { ascending: false })
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as OutreachTemplate[];
}

export async function upsertOutreachTemplate(
  data: Partial<OutreachTemplate> & { name: string; body: string }
): Promise<void> {
  const supabase = await requireAuth();
  // Solo owner/admin: una plantilla aprobada por Meta es un compromiso de la
  // empresa, y dejar que se le edite el texto después de aprobada sería una
  // forma silenciosa de saltearse la aprobación.
  await requireRole(supabase, "admin");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    name: data.name.trim(),
    meta_template_name: data.meta_template_name?.trim() || null,
    language: data.language?.trim() || "es_AR",
    category: data.category ?? "marketing",
    status: data.status ?? "borrador",
    rejection_reason: data.rejection_reason?.trim() || null,
    body: data.body.trim(),
    variables: data.variables ?? [],
    active: data.active ?? true,
  };

  if (data.id) {
    const { error } = await supabase.from("outreach_templates").update(payload).eq("id", data.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("outreach_templates")
      .insert({ ...payload, created_by: user?.id ?? null });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/plantillas");
  revalidatePath("/admin/clientes");
}

export async function deleteOutreachTemplate(id: string): Promise<void> {
  const supabase = await requireAuth();
  await requireRole(supabase, "admin");
  const { error } = await supabase.from("outreach_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/plantillas");
}

// ─── Escribirle a un cliente ─────────────────────────────────────────────────

export interface OutreachContext {
  window: WindowState;
  /** Vista previa por plantilla, ya con los datos de la ficha reemplazados. */
  previews: Array<{ template: OutreachTemplate; text: string }>;
  quota: { used: number; limit: number };
  transport: OutreachTransport;
  alreadyContactedAt: string | null;
  phone: string | null;
}

/** Todo lo que la pantalla necesita para decidir cómo escribirle a un cliente. */
export async function getOutreachContext(contactId: string): Promise<OutreachContext> {
  const supabase = await requireAuth();

  const { data: contact, error } = await supabase
    .from("crm_contacts")
    .select("*")
    .eq("id", contactId)
    .single();
  if (error || !contact) throw new Error("Cliente no encontrado");

  const [windowState, templates, usage] = await Promise.all([
    getWindowState(supabase, contactId),
    listOutreachTemplates(),
    supabase
      .from("prospect_api_usage")
      .select("cold_messages")
      .eq("day", new Date().toISOString().slice(0, 10))
      .maybeSingle(),
  ]);

  return {
    window: windowState,
    previews: templates
      .filter((t) => t.active)
      .map((t) => ({ template: t, text: renderTemplate(t, contact as CrmContact) })),
    quota: { used: usage.data?.cold_messages ?? 0, limit: dailyColdLimit() },
    transport: currentTransport(),
    alreadyContactedAt: contact.outreach_at,
    phone: contact.whatsapp_phone ?? contact.phone,
  };
}

/**
 * Asegura que exista una conversación abierta para el contacto y devuelve su
 * id. No manda nada: es lo que usa "Abrir en la Bandeja".
 */
export async function openConversation(contactId: string): Promise<string> {
  const supabase = await requireAuth();

  const { data: existing } = await supabase
    .from("crm_conversations")
    .select("id")
    .eq("contact_id", contactId)
    .eq("status", "open")
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("crm_conversations")
    .insert({ contact_id: contactId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/admin/inbox");
  return created.id;
}

export interface OutreachResult {
  conversationId: string;
  quota: { used: number; limit: number };
}

/**
 * Manda el primer mensaje a un prospecto y deja la conversación abierta en la
 * Bandeja para seguirla desde ahí.
 *
 * El orden importa: primero se reserva el cupo del día (atómico), después se
 * envía, y recién al final se guarda. Si el envío falla se devuelve el cupo —
 * no tiene sentido castigar al operador por un error de red.
 */
export async function sendOutreach(opts: {
  contactId: string;
  templateId?: string;
  /** Texto libre. Con Meta solo se permite dentro de la ventana de 24 h. */
  text?: string;
}): Promise<OutreachResult> {
  const supabase = await requireAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: contact, error: contactErr } = await supabase
    .from("crm_contacts")
    .select("*")
    .eq("id", opts.contactId)
    .single();
  if (contactErr || !contact) throw new Error("Cliente no encontrado");

  // Se prefiere el WhatsApp confirmado; si no hay, el teléfono de Google. Con
  // Evolution un fijo simplemente va a fallar al enviar, y está bien: es mejor
  // ver el error que fingir que se mandó.
  const phone = contact.whatsapp_phone ?? contact.phone;
  if (!phone) {
    throw new OutreachBlocked("no-phone", "Este cliente no tiene un número al que escribirle.");
  }

  let template: OutreachTemplate | null = null;
  let text: string;

  if (opts.templateId) {
    const { data } = await supabase
      .from("outreach_templates")
      .select("*")
      .eq("id", opts.templateId)
      .single();
    if (!data) throw new Error("Plantilla no encontrada");
    template = data as OutreachTemplate;
    text = renderTemplate(template, contact as CrmContact);
  } else if (opts.text?.trim()) {
    text = opts.text.trim();
  } else {
    throw new Error("Hace falta una plantilla o un texto");
  }

  const windowState = await getWindowState(supabase, opts.contactId);

  // El tope solo aplica al contacto en frío. Contestar dentro de la ventana no
  // consume cupo: no es prospección, es atender a alguien que nos escribió.
  const isCold = !windowState.open;
  let quotaUsed = 0;

  if (isCold) {
    const { data: reserved } = await supabase.rpc("reserve_cold_message", {
      p_limit: dailyColdLimit(),
    });
    const row = Array.isArray(reserved) ? reserved[0] : reserved;
    quotaUsed = row?.used ?? 0;
    if (!row?.allowed) {
      throw new OutreachBlocked(
        "quota",
        "Llegaste al tope de " +
          dailyColdLimit() +
          " mensajes en frío por día. Seguí mañana: el tope existe para que WhatsApp no bloquee la línea."
      );
    }
  }

  const conversationId = await openConversation(opts.contactId);

  try {
    const { waMessageId } = await deliver({
      phone,
      text,
      isFreeform: !template,
      windowOpen: windowState.open,
      template,
    });

    await supabase.from("crm_messages").insert({
      conversation_id: conversationId,
      direction: "out",
      content_type: "text",
      content_text: text,
      wa_message_id: waMessageId ?? null,
      sender_member_id: user?.id ?? null,
      is_outreach: isCold,
      template_id: template?.id ?? null,
    });

    await supabase
      .from("crm_conversations")
      .update({
        last_message_text: text,
        last_message_at: new Date().toISOString(),
        // Lo inició una persona: la IA no debe contestar encima de esta charla.
        assigned_member_id: user?.id ?? null,
      })
      .eq("id", conversationId);

    if (isCold) {
      await supabase
        .from("crm_contacts")
        .update({
          // La fecha es la del PRIMER contacto y no se pisa: sirve para saber
          // hace cuánto se lo viene trabajando.
          outreach_at: contact.outreach_at ?? new Date().toISOString(),
          outreach_count: (contact.outreach_count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", opts.contactId);
    }
  } catch (err) {
    if (isCold) await supabase.rpc("release_cold_message");
    if (err instanceof OutreachBlocked) throw err;
    throw new Error(
      "No se pudo enviar: " + (err instanceof Error ? err.message : "error desconocido")
    );
  }

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/inbox");
  return { conversationId, quota: { used: quotaUsed, limit: dailyColdLimit() } };
}
