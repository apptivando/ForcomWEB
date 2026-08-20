"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, type AdminRole } from "@/lib/auth/roles";
import { sendText } from "@/lib/evolution";
import { encrypt, decrypt } from "@/lib/encryption";
import { ingestDocument, reindexAllEmbeddings } from "@/lib/ai/knowledge";
import { generateAssistantReply } from "@/lib/ai/auto-reply";
import type { ChatMessage } from "@/lib/ai/generate";
import { searchPlaces, PlacesError } from "@/lib/prospects/places";
import { classifyUrl } from "@/lib/prospects/urls";
import { enrichBatch } from "@/lib/prospects/enrich";
import { toE164Ar, toWhatsappNumber } from "@/lib/phone";
import { CLIENTS_PAGE_SIZE } from "@/lib/types";
import type {
  HeroContent,
  HeroSlide,
  Product,
  CompanyInfo,
  CrmContact,
  ClientOrigin,
  ContactTier,
  ProspectSearch,
  CrmConversation,
  CrmMessage,
  QuickReply,
  AiConfig,
  AiKnowledgeDocument,
  PipelineStage,
  PipelineDeal,
  Automation,
  AutomationStep,
} from "@/lib/types";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return supabase;
}

async function siteOrigin() {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// ─── Hero ────────────────────────────────────────────────────────────────────

export async function updateHeroContent(data: HeroContent) {
  const supabase = await requireAuth();
  const { error } = await supabase
    .from("hero_content")
    .update({
      badge_text: data.badge_text,
      headline_line1: data.headline_line1,
      headline_line2: data.headline_line2,
      headline_red: data.headline_red,
      subheadline: data.subheadline,
      cta_primary: data.cta_primary,
      cta_secondary: data.cta_secondary,
      trust_item_1: data.trust_item_1,
      trust_item_2: data.trust_item_2,
      trust_item_3: data.trust_item_3,
      hero_image_url: data.hero_image_url || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/admin/hero");
}

// ─── Hero Slides ─────────────────────────────────────────────────────────────

type SlidePayload = Omit<HeroSlide, "id" | "created_at" | "updated_at">;

export async function createHeroSlide(data: SlidePayload): Promise<HeroSlide> {
  const supabase = await requireAuth();
  const { data: slide, error } = await supabase
    .from("hero_slides")
    .insert({ ...data, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/admin/hero");
  return slide as HeroSlide;
}

export async function updateHeroSlide(id: string, data: Partial<SlidePayload>): Promise<HeroSlide> {
  const supabase = await requireAuth();
  const { data: slide, error } = await supabase
    .from("hero_slides")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/admin/hero");
  return slide as HeroSlide;
}

export async function deleteHeroSlide(id: string): Promise<void> {
  const supabase = await requireAuth();
  const { error } = await supabase.from("hero_slides").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/admin/hero");
}

export async function toggleHeroSlideActive(id: string, active: boolean): Promise<void> {
  const supabase = await requireAuth();
  const { error } = await supabase
    .from("hero_slides")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/admin/hero");
}

export async function reorderHeroSlides(items: Array<{ id: string; order_index: number }>): Promise<void> {
  const supabase = await requireAuth();
  await Promise.all(
    items.map(({ id, order_index }) =>
      supabase
        .from("hero_slides")
        .update({ order_index, updated_at: new Date().toISOString() })
        .eq("id", id)
    )
  );
  revalidatePath("/");
  revalidatePath("/admin/hero");
}

// ─── Productos ───────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof requireAuth>>,
  model: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(model);
  let slug = base;
  let suffix = 2;
  for (;;) {
    let query = supabase.from("products").select("id").eq("slug", slug);
    if (excludeId) query = query.neq("id", excludeId);
    const { data: existing } = await query.maybeSingle();
    if (!existing) return slug;
    slug = `${base}-${suffix}`;
    suffix++;
  }
}

export async function upsertProduct(data: Partial<Product> & { model: string }) {
  const supabase = await requireAuth();
  const slug = await uniqueSlug(supabase, data.model, data.id);
  const payload = {
    model: data.model,
    slug,
    category: data.category ?? "",
    section: data.section ?? "",
    section_id: data.section_id ?? "",
    badge: data.badge ?? null,
    image_url: data.image_url ?? null,
    images: data.images ?? [],
    videos: data.videos ?? [],
    description: data.description ?? null,
    full_specs: data.full_specs ?? null,
    files: data.files ?? [],
    specs: data.specs ?? [],
    active: data.active ?? true,
    order_index: data.order_index ?? 0,
    updated_at: new Date().toISOString(),
  };

  if (data.id) {
    const { error } = await supabase.from("products").update(payload).eq("id", data.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("products").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/admin/productos");
}

export async function deleteProduct(id: string) {
  const supabase = await requireAuth();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/admin/productos");
}

export async function toggleProductActive(id: string, active: boolean) {
  const supabase = await requireAuth();
  const { error } = await supabase
    .from("products")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/admin/productos");
}

// ─── CRM ─────────────────────────────────────────────────────────────────────

export async function updateMessageStatus(
  id: string,
  status: "nuevo" | "leido" | "contactado"
) {
  const supabase = await requireAuth();
  const { error } = await supabase
    .from("contact_messages")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/crm");
  revalidatePath("/admin/dashboard");
}

export async function updateMessageNotes(id: string, admin_notes: string) {
  const supabase = await requireAuth();
  const { error } = await supabase
    .from("contact_messages")
    .update({ admin_notes, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/crm");
}

export async function deleteMessage(id: string) {
  const supabase = await requireAuth();
  const { error } = await supabase.from("contact_messages").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/crm");
  revalidatePath("/admin/dashboard");
}

// ─── Company Info ─────────────────────────────────────────────────────────────

export async function updateCompanyInfo(data: Omit<CompanyInfo, "id" | "updated_at">) {
  const supabase = await requireAuth();
  const { error } = await supabase
    .from("company_info")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/admin/empresa");
}

// ─── Miembros del admin (Track E, fase 1) ─────────────────────────────────────

export async function inviteMember(email: string, role: AdminRole) {
  const supabase = await requireAuth();
  const { data: { user } } = await supabase.auth.getUser();
  await requireRole(supabase, "admin");

  const normalizedEmail = email.trim().toLowerCase();

  const { error: inviteErr } = await supabase.from("admin_invitations").insert({
    email: normalizedEmail,
    role,
    invited_by: user!.id,
  });
  if (inviteErr) throw new Error(inviteErr.message);

  const origin = await siteOrigin();
  const admin = createAdminClient();
  const { error: sendErr } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo: `${origin}/admin/join`,
  });
  if (sendErr) throw new Error(`Invitación guardada pero el email falló: ${sendErr.message}`);

  revalidatePath("/admin/miembros");
}

export async function cancelInvitation(id: string) {
  const supabase = await requireAuth();
  await requireRole(supabase, "admin");
  const { error } = await supabase.from("admin_invitations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}

export async function updateMemberRole(userId: string, role: AdminRole) {
  const supabase = await requireAuth();
  await requireRole(supabase, "admin");
  const { error } = await supabase
    .from("admin_members")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}

export async function removeMember(userId: string) {
  const supabase = await requireAuth();
  const { data: { user } } = await supabase.auth.getUser();
  await requireRole(supabase, "admin");
  if (user!.id === userId) throw new Error("No podés quitarte a vos mismo.");
  const { error } = await supabase.from("admin_members").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}

/**
 * Completa la invitación: llamado desde /admin/join una vez que el
 * usuario invitado ya está autenticado (Supabase procesó el link del
 * mail) y eligió su contraseña. Busca la invitación pendiente por
 * email, crea la fila en admin_members con el rol que le asignaron, y
 * marca la invitación como aceptada.
 */
export async function acceptInvitation() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("No autorizado");

  const { data: invitation, error: findErr } = await supabase
    .from("admin_invitations")
    .select("id, role, expires_at, accepted_at")
    .eq("email", user.email.toLowerCase())
    .is("accepted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!invitation) throw new Error("No hay una invitación pendiente para este email.");
  if (new Date(invitation.expires_at) < new Date()) {
    throw new Error("La invitación venció — pedile a un admin que te invite de nuevo.");
  }

  const admin = createAdminClient();
  const { error: memberErr } = await admin.from("admin_members").insert({
    user_id: user.id,
    role: invitation.role,
  });
  if (memberErr) throw new Error(memberErr.message);

  await admin
    .from("admin_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);
}

// ─── Bandeja de WhatsApp (Track E, fase 3) ────────────────────────────────────

/**
 * Contactos que se pueden asociar a una oportunidad del Pipeline.
 * Solo los que tienen alguna forma de contacto (tier 1-3): un prospecto sin
 * datos todavía no es alguien a quien vender.
 */
export async function listCrmContacts(): Promise<CrmContact[]> {
  const supabase = await requireAuth();
  const { data, error } = await supabase
    .from("crm_contacts")
    .select("*")
    .lt("contact_tier", 4)
    .order("business_name", { ascending: true, nullsFirst: false })
    .order("contact_name", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listConversations(): Promise<CrmConversation[]> {
  const supabase = await requireAuth();
  const { data, error } = await supabase
    .from("crm_conversations")
    .select("*, contact:crm_contacts(*)")
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CrmConversation[];
}

export async function getConversationMessages(conversationId: string): Promise<CrmMessage[]> {
  const supabase = await requireAuth();
  const { data, error } = await supabase
    .from("crm_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CrmMessage[];
}

export async function sendCrmReply(conversationId: string, text: string): Promise<void> {
  const supabase = await requireAuth();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: conversation, error: convErr } = await supabase
    .from("crm_conversations")
    .select("*, contact:crm_contacts(*)")
    .eq("id", conversationId)
    .single();
  if (convErr || !conversation) throw new Error("Conversación no encontrada");

  // Evolution primero — si falla, no queda un mensaje "fantasma" guardado
  // como si hubiera salido.
  let waMessageId: string | undefined;
  try {
    const result = await sendText(conversation.contact.phone, text);
    waMessageId = result?.key?.id;
  } catch (err) {
    throw new Error(
      `No se pudo enviar por WhatsApp: ${err instanceof Error ? err.message : "error desconocido"}`
    );
  }

  const { error: msgErr } = await supabase.from("crm_messages").insert({
    conversation_id: conversationId,
    direction: "out",
    content_type: "text",
    content_text: text,
    wa_message_id: waMessageId ?? null,
    sender_member_id: user!.id,
  });
  if (msgErr) throw new Error(msgErr.message);

  await supabase
    .from("crm_conversations")
    .update({
      last_message_text: text,
      last_message_at: new Date().toISOString(),
      // Un humano contestó — la IA no debe seguir respondiendo encima
      // en esta conversación.
      assigned_member_id: user!.id,
    })
    .eq("id", conversationId);

  revalidatePath("/admin/inbox");
}

export async function listQuickReplies(): Promise<QuickReply[]> {
  const supabase = await requireAuth();
  const { data, error } = await supabase
    .from("quick_replies")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as QuickReply[];
}

export async function createQuickReply(title: string, body: string): Promise<void> {
  const supabase = await requireAuth();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("quick_replies")
    .insert({ title: title.trim(), body: body.trim(), created_by: user!.id });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/inbox");
}

export async function deleteQuickReply(id: string): Promise<void> {
  const supabase = await requireAuth();
  const { error } = await supabase.from("quick_replies").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/inbox");
}

// ─── Asistente de IA (Track E, fase 4) ────────────────────────────────────────

export async function getAiConfig(): Promise<AiConfig> {
  const supabase = await requireAuth();
  const { data, error } = await supabase.from("ai_config").select("*").eq("id", 1).single();
  if (error) throw new Error(error.message);
  return {
    provider: data.provider,
    model: data.model,
    hasApiKey: Boolean(data.api_key_encrypted),
    hasEmbeddingsKey: Boolean(data.embeddings_api_key_encrypted),
    system_prompt: data.system_prompt,
    auto_reply_enabled: data.auto_reply_enabled,
    max_replies_per_conversation: data.max_replies_per_conversation,
  };
}

export async function updateAiConfig(data: {
  provider: "anthropic" | "openai";
  model: string;
  apiKey?: string; // solo si se está cambiando — nunca se devuelve al cliente
  embeddingsApiKey?: string;
  system_prompt: string;
  auto_reply_enabled: boolean;
  max_replies_per_conversation: number;
}): Promise<void> {
  const supabase = await requireAuth();
  await requireRole(supabase, "admin");

  const update: Record<string, unknown> = {
    provider: data.provider,
    model: data.model,
    system_prompt: data.system_prompt,
    auto_reply_enabled: data.auto_reply_enabled,
    max_replies_per_conversation: data.max_replies_per_conversation,
    updated_at: new Date().toISOString(),
  };
  if (data.apiKey?.trim()) {
    update.api_key_encrypted = encrypt(data.apiKey.trim());
  }
  if (data.embeddingsApiKey?.trim()) {
    update.embeddings_api_key_encrypted = encrypt(data.embeddingsApiKey.trim());
  }

  const { error } = await supabase.from("ai_config").update(update).eq("id", 1);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/agente");
}

/** Recalcula el embedding de todos los chunks — para cuando se agrega la clave después de haber cargado documentos. */
export async function reindexKnowledgeEmbeddings(): Promise<number> {
  const supabase = await requireAuth();
  await requireRole(supabase, "admin");

  const { data: config, error } = await supabase.from("ai_config").select("embeddings_api_key_encrypted").eq("id", 1).single();
  if (error || !config?.embeddings_api_key_encrypted) {
    throw new Error("No hay clave de embeddings cargada.");
  }

  const count = await reindexAllEmbeddings(supabase, decrypt(config.embeddings_api_key_encrypted));
  revalidatePath("/admin/agente");
  return count;
}

export async function listKnowledgeDocuments(): Promise<AiKnowledgeDocument[]> {
  const supabase = await requireAuth();
  const { data, error } = await supabase
    .from("ai_knowledge_documents")
    .select("id, title, content, created_at, updated_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AiKnowledgeDocument[];
}

export async function upsertKnowledgeDocument(
  id: string | null,
  title: string,
  content: string
): Promise<void> {
  const supabase = await requireAuth();
  const { data: { user } } = await supabase.auth.getUser();

  let documentId = id;
  if (documentId) {
    const { error } = await supabase
      .from("ai_knowledge_documents")
      .update({ title: title.trim(), content: content.trim(), updated_at: new Date().toISOString() })
      .eq("id", documentId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("ai_knowledge_documents")
      .insert({ title: title.trim(), content: content.trim(), created_by: user!.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    documentId = data.id;
  }

  const { data: config } = await supabase.from("ai_config").select("embeddings_api_key_encrypted").eq("id", 1).single();
  const embeddingsApiKey = config?.embeddings_api_key_encrypted
    ? decrypt(config.embeddings_api_key_encrypted)
    : null;

  await ingestDocument(supabase, documentId!, content.trim(), embeddingsApiKey);
  revalidatePath("/admin/agente");
}

export async function deleteKnowledgeDocument(id: string): Promise<void> {
  const supabase = await requireAuth();
  const { error } = await supabase.from("ai_knowledge_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/agente");
}

/**
 * Prueba el asistente sin tocar WhatsApp para nada — misma lógica
 * exacta que el auto-reply real (mismo retrieval, mismo mapa de
 * catálogo, mismo prompt), solo que no manda ni guarda nada.
 *
 * Recibe la conversación completa hasta ahora (incluyendo el mensaje
 * nuevo del "cliente" al final) para que el modo de prueba también
 * pueda simular idas y vueltas — necesario para probar el flujo de
 * "pregunta genérica → el asistente pide precisar → el cliente aclara
 * → recién ahí recomienda", no solo una pregunta suelta.
 */
export async function testAiReply(history: ChatMessage[]): Promise<string> {
  const supabase = await requireAuth();
  const { data: config, error } = await supabase.from("ai_config").select("*").eq("id", 1).single();
  if (error || !config) throw new Error("No se pudo leer la configuración del asistente.");
  if (!config.api_key_encrypted) throw new Error("Todavía no hay una clave de API cargada.");

  return generateAssistantReply(supabase, config, history);
}

// ─── Pipelines de venta (Track E, fase 5) ─────────────────────────────────────

export async function listPipelineStages(): Promise<PipelineStage[]> {
  const supabase = await requireAuth();
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("id, name, order_index")
    .order("order_index");
  if (error) throw new Error(error.message);
  return (data ?? []) as PipelineStage[];
}

export async function listPipelineDeals(): Promise<PipelineDeal[]> {
  const supabase = await requireAuth();
  const { data, error } = await supabase
    .from("pipeline_deals")
    .select("*, contact:crm_contacts(*)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PipelineDeal[];
}

export async function createPipelineDeal(data: {
  contactId: string;
  stageId: string;
  title: string;
  value?: number | null;
}): Promise<void> {
  const supabase = await requireAuth();
  const { error } = await supabase.from("pipeline_deals").insert({
    contact_id: data.contactId,
    stage_id: data.stageId,
    title: data.title.trim(),
    value: data.value ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pipelines");
}

export async function moveDealStage(dealId: string, stageId: string): Promise<void> {
  const supabase = await requireAuth();
  const { error } = await supabase
    .from("pipeline_deals")
    .update({ stage_id: stageId })
    .eq("id", dealId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pipelines");
}

export async function updatePipelineDeal(
  dealId: string,
  data: { title: string; value: number | null; notes: string | null }
): Promise<void> {
  const supabase = await requireAuth();
  const { error } = await supabase
    .from("pipeline_deals")
    .update({ title: data.title.trim(), value: data.value, notes: data.notes?.trim() || null })
    .eq("id", dealId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pipelines");
}

export async function deletePipelineDeal(dealId: string): Promise<void> {
  const supabase = await requireAuth();
  const { error } = await supabase.from("pipeline_deals").delete().eq("id", dealId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pipelines");
}

// ─── Automatizaciones (Track E, fase 6) ───────────────────────────────────────

export async function listAutomations(): Promise<Automation[]> {
  const supabase = await requireAuth();
  const { data: automations, error } = await supabase
    .from("automations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!automations?.length) return [];

  const { data: steps } = await supabase
    .from("automation_steps")
    .select("*")
    .in("automation_id", automations.map((a) => a.id))
    .order("step_index");

  return automations.map((a) => ({
    ...a,
    steps: (steps ?? []).filter((s) => s.automation_id === a.id),
  })) as Automation[];
}

async function replaceSteps(
  supabase: Awaited<ReturnType<typeof requireAuth>>,
  automationId: string,
  steps: AutomationStep[]
) {
  await supabase.from("automation_steps").delete().eq("automation_id", automationId);
  if (!steps.length) return;
  const rows = steps.map((s, i) => ({
    automation_id: automationId,
    step_index: i,
    action_type: s.action_type,
    message_text: s.action_type === "send_message" ? s.message_text : null,
    wait_minutes: s.action_type === "wait" ? s.wait_minutes : null,
    assign_member_id: s.action_type === "assign_agent" ? s.assign_member_id : null,
  }));
  const { error } = await supabase.from("automation_steps").insert(rows);
  if (error) throw new Error(error.message);
}

export async function upsertAutomation(
  id: string | null,
  data: {
    name: string;
    trigger_type: "keyword_match" | "new_conversation";
    trigger_keywords: string[];
    steps: AutomationStep[];
  }
): Promise<void> {
  const supabase = await requireAuth();
  const { data: { user } } = await supabase.auth.getUser();

  let automationId = id;
  if (automationId) {
    const { error } = await supabase
      .from("automations")
      .update({
        name: data.name.trim(),
        trigger_type: data.trigger_type,
        trigger_keywords: data.trigger_type === "keyword_match" ? data.trigger_keywords : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", automationId);
    if (error) throw new Error(error.message);
  } else {
    const { data: created, error } = await supabase
      .from("automations")
      .insert({
        name: data.name.trim(),
        trigger_type: data.trigger_type,
        trigger_keywords: data.trigger_type === "keyword_match" ? data.trigger_keywords : null,
        created_by: user!.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    automationId = created.id;
  }

  await replaceSteps(supabase, automationId!, data.steps);
  revalidatePath("/admin/automatizaciones");
}

export async function toggleAutomationActive(id: string, active: boolean): Promise<void> {
  const supabase = await requireAuth();
  const { error } = await supabase.from("automations").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/automatizaciones");
}

export async function deleteAutomation(id: string): Promise<void> {
  const supabase = await requireAuth();
  const { error } = await supabase.from("automations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/automatizaciones");
}

/** Para el selector de "asignar a" en los pasos — mismo cruce que /admin/miembros. */
export async function listMembersForAssignment(): Promise<{ user_id: string; email: string }[]> {
  const supabase = await requireAuth();
  const { data: members } = await supabase.from("admin_members").select("user_id");
  if (!members?.length) return [];

  const admin = createAdminClient();
  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 200 });
  const emailByUserId = new Map(usersPage?.users.map((u) => [u.id, u.email ?? ""]));

  return members.map((m) => ({ user_id: m.user_id, email: emailByUserId.get(m.user_id) ?? m.user_id }));
}

// ─── Clientes (Track E, fases 7 y 8) ──────────────────────────────────────────
// La tabla `crm_contacts` es la ficha única de cliente: prospectos del scraper,
// contactos de WhatsApp y leads del formulario, diferenciados por `origin`.

export interface ClientFilters {
  q?: string;
  origin?: ClientOrigin;
  tier?: ContactTier;
  rubro?: string;
  locality?: string;
  searchId?: string;
  page?: number;
}

export async function listClients(
  filters: ClientFilters = {}
): Promise<{ clients: CrmContact[]; total: number }> {
  const supabase = await requireAuth();

  let query = supabase.from("crm_contacts").select("*", { count: "exact" });

  if (filters.searchId) {
    // Los ids de una búsqueda puntual salen de la tabla puente. Se resuelve en
    // dos pasos en vez de con un join anidado porque PostgREST no deja filtrar
    // la tabla principal por la existencia de una fila en la puente sin
    // arrastrar sus columnas al resultado.
    const { data: ids, error: idsErr } = await supabase
      .from("prospect_search_results")
      .select("contact_id")
      .eq("search_id", filters.searchId);
    if (idsErr) throw new Error(idsErr.message);
    const list = (ids ?? []).map((r) => r.contact_id);
    if (list.length === 0) return { clients: [], total: 0 };
    query = query.in("id", list);
  }

  if (filters.origin) query = query.eq("origin", filters.origin);
  if (filters.tier) query = query.eq("contact_tier", filters.tier);
  if (filters.rubro) query = query.eq("rubro", filters.rubro);
  if (filters.locality) query = query.eq("locality", filters.locality);

  if (filters.q?.trim()) {
    // `or` de PostgREST: la coma separa condiciones y el asterisco es el
    // comodín de ilike. Se escapan las comas del término para no romper el
    // parseo del filtro.
    const term = filters.q.trim().replace(/[,()]/g, " ");
    query = query.or(
      [
        `business_name.ilike.*${term}*`,
        `contact_name.ilike.*${term}*`,
        `email.ilike.*${term}*`,
        `phone.ilike.*${term}*`,
        `rubro.ilike.*${term}*`,
        `locality.ilike.*${term}*`,
      ].join(",")
    );
  }

  const page = Math.max(filters.page ?? 1, 1);
  const from = (page - 1) * CLIENTS_PAGE_SIZE;

  // El orden ES el requisito de negocio: primero WhatsApp, después email,
  // después teléfono, al final los que quedaron sin nada.
  const { data, error, count } = await query
    .order("contact_tier", { ascending: true })
    .order("updated_at", { ascending: false })
    .range(from, from + CLIENTS_PAGE_SIZE - 1);

  if (error) throw new Error(error.message);
  return { clients: (data ?? []) as CrmContact[], total: count ?? 0 };
}

/** Contadores por prioridad de contacto, para las cabeceras de grupo. */
export async function getClientTierCounts(): Promise<Record<ContactTier, number>> {
  const supabase = await requireAuth();
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<ContactTier, number>;

  // Cuatro `count` en paralelo en vez de traer todas las filas para agrupar en
  // JS: con miles de clientes eso último sería traer la tabla entera al server.
  await Promise.all(
    ([1, 2, 3, 4] as ContactTier[]).map(async (tier) => {
      const { count } = await supabase
        .from("crm_contacts")
        .select("id", { count: "exact", head: true })
        .eq("contact_tier", tier);
      counts[tier] = count ?? 0;
    })
  );

  return counts;
}

/** Valores distintos de rubro y localidad, para poblar los selectores de filtro. */
export async function getClientFacets(): Promise<{ rubros: string[]; localities: string[] }> {
  const supabase = await requireAuth();
  const { data, error } = await supabase
    .from("crm_contacts")
    .select("rubro, locality")
    .limit(5000);
  if (error) throw new Error(error.message);

  const rubros = new Set<string>();
  const localities = new Set<string>();
  for (const row of data ?? []) {
    if (row.rubro) rubros.add(row.rubro);
    if (row.locality) localities.add(row.locality);
  }
  return {
    rubros: [...rubros].sort((a, b) => a.localeCompare(b, "es")),
    localities: [...localities].sort((a, b) => a.localeCompare(b, "es")),
  };
}

/** Cuántos prospectos esperan enriquecimiento. Se muestra arriba de la tabla. */
export async function getEnrichmentQueueCount(): Promise<number> {
  const supabase = await requireAuth();
  const { count } = await supabase
    .from("crm_contacts")
    .select("id", { count: "exact", head: true })
    .in("enrichment_status", ["pending", "running"]);
  return count ?? 0;
}

export async function listProspectSearches(limit = 8): Promise<ProspectSearch[]> {
  const supabase = await requireAuth();
  const { data, error } = await supabase
    .from("prospect_searches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ProspectSearch[];
}

/** Cuántas consultas del nivel 3 se gastaron hoy, para mostrarlo en la UI. */
export async function getCseUsageToday(): Promise<{ used: number; limit: number }> {
  const supabase = await requireAuth();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("prospect_api_usage")
    .select("cse_queries")
    .eq("day", today)
    .maybeSingle();
  return {
    used: data?.cse_queries ?? 0,
    limit: Number(process.env.PROSPECT_SEARCH_DAILY_LIMIT ?? 90),
  };
}

// ─── Buscador de prospectos (Google Places) ───────────────────────────────────

export interface ProspectSearchInput {
  rubro: string;
  locality: string;
  includedType?: string;
  maxResults?: number;
}

export interface ProspectSearchOutcome {
  searchId: string;
  /** Cuántos entraron a la base (los cerrados definitivamente no cuentan). */
  total: number;
  /** De esos, cuántos no existían todavía. El resto se fusionó con su ficha. */
  created: number;
  /** Descartados por figurar como cerrados definitivamente en Google. */
  skippedClosed: number;
}

export async function searchProspects(input: ProspectSearchInput): Promise<ProspectSearchOutcome> {
  const supabase = await requireAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rubro = input.rubro.trim();
  const locality = input.locality.trim();
  if (!rubro || !locality) throw new Error("Hacen falta el rubro y la localidad");

  // El "en <localidad>, Argentina" le da a Places el contexto geográfico sin
  // tener que pasar coordenadas. `regionCode: AR` solo sesga, no restringe.
  const query = `${rubro} en ${locality}, Argentina`;

  const { data: search, error: searchErr } = await supabase
    .from("prospect_searches")
    .insert({
      rubro,
      locality,
      query,
      included_type: input.includedType || null,
      status: "running",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (searchErr) throw new Error(searchErr.message);

  try {
    const places = await searchPlaces({
      query,
      includedType: input.includedType,
      maxResults: input.maxResults,
    });

    // Un local que Google marca como cerrado definitivamente no es un
    // prospecto: ensuciaría la lista y consumiría cuota de enriquecimiento.
    const open = places.filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY");
    const skippedClosed = places.length - open.length;

    const items = open.map((p) => {
      // El teléfono internacional es el único que trae el marcador de celular
      // (+54 9), que es de donde sale `whatsapp_likely`.
      const parsed = toE164Ar(p.internationalPhone ?? p.nationalPhone ?? "");
      const site = classifyUrl(p.website);

      return {
        place_id: p.id,
        name: p.name,
        phone: parsed?.e164 ?? null,
        wa_likely: parsed?.isMobile ?? false,
        address: p.address,
        website: site.kind === "web" || site.kind === "linkinbio" ? site.url : null,
        instagram: site.kind === "instagram" ? site.url : null,
        facebook: site.kind === "facebook" ? site.url : null,
        linkedin: site.kind === "linkedin" ? site.url : null,
        maps_url: p.mapsUrl,
        rating: p.rating,
        reviews: p.reviewsCount,
        rubro: p.primaryType ?? rubro,
        locality,
      };
    });

    // Una sola llamada para los 60: sesenta upserts sueltos serían varios
    // segundos de pura latencia contra Supabase.
    const { data: result, error: rpcErr } = await supabase.rpc("upsert_prospects", {
      p_search_id: search.id,
      p_items: items,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    const row = Array.isArray(result) ? result[0] : result;
    const total = row?.total ?? 0;
    const created = row?.created ?? 0;

    await supabase
      .from("prospect_searches")
      .update({
        status: "done",
        results_count: total,
        new_count: created,
        finished_at: new Date().toISOString(),
      })
      .eq("id", search.id);

    revalidatePath("/admin/clientes");
    return { searchId: search.id, total, created, skippedClosed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    await supabase
      .from("prospect_searches")
      .update({ status: "error", error: message, finished_at: new Date().toISOString() })
      .eq("id", search.id);

    // El `hint` de PlacesError dice qué hacer (habilitar la API, cargar la
    // key, etc.) — sin él el mensaje crudo de Google no le sirve a nadie.
    const hint = err instanceof PlacesError ? err.hint : undefined;
    throw new Error(hint ? `${message}\n\n${hint}` : message);
  }
}

/**
 * Procesa un lote chico de la cola al instante, para no esperar al cron.
 * Deliberadamente corto (5 prospectos): es una Server Action y el usuario está
 * mirando la pantalla. El grueso lo hace el cron cada 5 minutos.
 */
export async function enrichNow(limit = 5): Promise<{
  processed: number;
  email: number;
  whatsapp: number;
  quotaExhausted: boolean;
}> {
  await requireAuth();
  // El enriquecedor escribe sobre fichas que la sesión puede ver igual, pero
  // usa la service key como el cron: así el mismo código corre idéntico en los
  // dos caminos y no hay una RLS que se comporte distinto según quién llame.
  const admin = createAdminClient();
  const result = await enrichBatch(admin, {
    limit: Math.min(Math.max(limit, 1), 10),
    deadline: Date.now() + 45_000,
  });

  revalidatePath("/admin/clientes");
  return {
    processed: result.processed,
    email: result.found.email,
    whatsapp: result.found.whatsapp,
    quotaExhausted: result.quotaExhausted,
  };
}

/** Vuelve a poner un prospecto en la cola, reseteando sus intentos. */
export async function requeueClient(id: string): Promise<void> {
  const supabase = await requireAuth();
  const { error } = await supabase
    .from("crm_contacts")
    .update({
      enrichment_status: "pending",
      enrichment_error: null,
      scrape_attempts: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/clientes");
}

export interface ClientEdit {
  business_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp_phone?: string | null;
  notes?: string | null;
}

/**
 * Edición manual de una ficha. Es la salida del nivel 4: cuando la cascada no
 * encontró nada, alguien abre el Instagram del comercio y carga el dato a mano.
 *
 * Lo que se guarda acá queda con `manual_lock`, y a partir de ese momento
 * ningún proceso automático vuelve a tocar la ficha (ni el enriquecedor ni el
 * merge de una búsqueda futura). Es deliberado: el trabajo de una persona vale
 * más que cualquier cosa que adivine el scraper.
 */
export async function updateClient(id: string, data: ClientEdit): Promise<void> {
  const supabase = await requireAuth();

  const clean = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);
  const patch: Record<string, unknown> = {
    manual_lock: true,
    updated_at: new Date().toISOString(),
  };

  if ("business_name" in data) patch.business_name = clean(data.business_name);
  if ("contact_name" in data) patch.contact_name = clean(data.contact_name);
  if ("email" in data) patch.email = clean(data.email)?.toLowerCase() ?? null;
  if ("notes" in data) patch.notes = clean(data.notes);

  // Los teléfonos se normalizan al mismo formato que usa el resto del sistema
  // (dígitos sin '+'), o quedan en null si no se pueden interpretar.
  if ("phone" in data) {
    const raw = clean(data.phone);
    patch.phone = raw ? (toE164Ar(raw)?.e164 ?? null) : null;
    if (raw && !patch.phone) throw new Error(`No se pudo interpretar el teléfono "${raw}"`);
  }
  if ("whatsapp_phone" in data) {
    const raw = clean(data.whatsapp_phone);
    const normalized = raw ? toWhatsappNumber(raw) : null;
    if (raw && !normalized) throw new Error(`No se pudo interpretar el WhatsApp "${raw}"`);
    patch.whatsapp_phone = normalized;
    patch.whatsapp_source = normalized ? "manual" : null;
  }

  const { error } = await supabase.from("crm_contacts").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/pipelines");
}

/**
 * Borra una ficha de cliente de verdad. El CASCADE se lleva sus conversaciones
 * y oportunidades. Solo owner/admin: un agente no debería poder perder el
 * historial de un cliente.
 */
export async function deleteClient(id: string): Promise<void> {
  const supabase = await requireAuth();
  await requireRole(supabase, "admin");
  const { error } = await supabase.from("crm_contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/clientes");
}

/**
 * Todos los clientes que matchean los filtros, para exportar a CSV.
 * Sin paginar pero con techo: 5.000 filas es más de lo que alguien va a
 * trabajar a mano y evita que un click tumbe el server.
 */
export async function exportClients(filters: ClientFilters = {}): Promise<CrmContact[]> {
  const pageSize = CLIENTS_PAGE_SIZE;
  const out: CrmContact[] = [];
  for (let page = 1; page <= Math.ceil(5000 / pageSize); page++) {
    const { clients } = await listClients({ ...filters, page });
    out.push(...clients);
    if (clients.length < pageSize) break;
  }
  return out;
}
