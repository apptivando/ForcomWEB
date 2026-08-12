"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, type AdminRole } from "@/lib/auth/roles";
import { sendText } from "@/lib/evolution";
import { encrypt } from "@/lib/encryption";
import { ingestDocument } from "@/lib/ai/knowledge";
import { generateAssistantReply } from "@/lib/ai/auto-reply";
import type { ChatMessage } from "@/lib/ai/generate";
import type {
  HeroContent,
  HeroSlide,
  Product,
  CompanyInfo,
  CrmConversation,
  CrmMessage,
  QuickReply,
  AiConfig,
  AiKnowledgeDocument,
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
    system_prompt: data.system_prompt,
    auto_reply_enabled: data.auto_reply_enabled,
    max_replies_per_conversation: data.max_replies_per_conversation,
  };
}

export async function updateAiConfig(data: {
  provider: "anthropic" | "openai";
  model: string;
  apiKey?: string; // solo si se está cambiando — nunca se devuelve al cliente
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

  const { error } = await supabase.from("ai_config").update(update).eq("id", 1);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/agente");
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

  await ingestDocument(supabase, documentId!, content.trim());
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
