"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  createAdminClient,
  createCredentialsClient,
  findAuthUserByEmail,
} from "@/lib/supabase/admin";
import { requireRole, type AdminRole } from "@/lib/auth/roles";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import {
  invitationExpiry,
  invitationUrl,
  lookupInvitation,
} from "@/lib/auth/invitations";
import {
  lookupPasswordReset,
  resetExpiry,
  resetUrl,
  RESET_THROTTLE_SECONDS,
} from "@/lib/auth/password-resets";
import { validatePassword } from "@/lib/auth/password";
import { sendEmail, EmailConfigError } from "@/lib/email/send";
import { invitationEmail } from "@/lib/email/invitation";
import { passwordResetEmail } from "@/lib/email/password-reset";
import { encrypt, decrypt } from "@/lib/encryption";
import { ingestDocument, reindexAllEmbeddings } from "@/lib/ai/knowledge";
import { generateAssistantReply } from "@/lib/ai/auto-reply";
import type { ChatMessage } from "@/lib/ai/generate";
import { searchPlaces, PlacesError } from "@/lib/prospects/places";
import { classifyUrl } from "@/lib/prospects/urls";
import { enrichBatch } from "@/lib/prospects/enrich";
import { sendOutreach } from "@/app/admin/outreach-actions";
import { toE164Ar, toWhatsappNumber } from "@/lib/phone";
import { CLIENTS_PAGE_SIZE } from "@/lib/types";
import type {
  HeroContent,
  HeroSlide,
  Product,
  CompanyInfo,
  ContactMessage,
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
  status: ContactMessage["status"]
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

/**
 * Marca mensajes del formulario como spam, en lote.
 *
 * Marcar no es borrar: el registro queda, así se puede revisar si el filtro se
 * comió algo legítimo. Lo que sí se hace es **limpiar el rastro en Clientes**,
 * que es donde el spam hacía el daño real: los dos envíos con razón social
 * generada al azar habían quedado clasificados en la prioridad "2 · Con email",
 * ensuciando la base de prospectos y cualquier exportación a CSV.
 *
 * La ficha del cliente se borra solo si cumple las dos condiciones:
 *
 *   · `origin = 'formulario'` — o sea que la creó este mismo formulario. Si el
 *     contacto ya existía como prospecto de Google o como conversación de
 *     WhatsApp, el mensaje spam no puede llevárselo puesto.
 *   · no tiene oportunidades en el pipeline — si alguien ya lo trabajó, no era
 *     spam, y borrarlo cascadearía sobre `pipeline_deals`.
 *
 * Devuelve cuántas fichas se limpiaron, para poder decirlo en el aviso.
 */
export async function markMessagesSpam(ids: string[]): Promise<{ clientesLimpiados: number }> {
  if (ids.length === 0) return { clientesLimpiados: 0 };
  const supabase = await requireAuth();

  const { data: messages, error: readError } = await supabase
    .from("contact_messages")
    .select("id, contact_id")
    .in("id", ids);
  if (readError) throw new Error(readError.message);

  const { error } = await supabase
    .from("contact_messages")
    .update({ status: "spam", updated_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw new Error(error.message);

  const contactIds = [...new Set((messages ?? []).map((m) => m.contact_id).filter(Boolean))] as string[];
  let clientesLimpiados = 0;

  if (contactIds.length > 0) {
    // Los que ya tienen una oportunidad quedan afuera: alguien los trabajó.
    const { data: withDeals } = await supabase
      .from("pipeline_deals")
      .select("contact_id")
      .in("contact_id", contactIds);
    const protegidos = new Set((withDeals ?? []).map((d) => d.contact_id));
    const borrables = contactIds.filter((id) => !protegidos.has(id));

    if (borrables.length > 0) {
      const { data: deleted } = await supabase
        .from("crm_contacts")
        .delete()
        .in("id", borrables)
        .eq("origin", "formulario")
        .select("id");
      clientesLimpiados = deleted?.length ?? 0;
    }
  }

  revalidatePath("/admin/crm");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/dashboard");
  return { clientesLimpiados };
}

/** Vuelve a poner en "nuevo" mensajes marcados como spam por error. */
export async function unmarkMessagesSpam(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await requireAuth();
  const { error } = await supabase
    .from("contact_messages")
    .update({ status: "nuevo", updated_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/crm");
  revalidatePath("/admin/dashboard");
}

/** Borrado en lote. Antes había que expandir cada mensaje y borrarlo de a uno. */
export async function deleteMessages(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await requireAuth();
  const { error } = await supabase.from("contact_messages").delete().in("id", ids);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/crm");
  revalidatePath("/admin/dashboard");
}

/**
 * Convierte un mensaje del formulario en una oportunidad del pipeline.
 *
 * Es el eslabón que faltaba. Hasta ahora cada sección resolvía su parte y
 * ninguna conectaba con la siguiente: llegaba la consulta, se podía cambiar el
 * estado y escribir notas, y para que apareciera en el Pipeline había que ir
 * hasta ahí y cargar todo de nuevo a mano. Por eso el Pipeline estaba en cero
 * — no por falta de oportunidades, sino porque nada las creaba.
 *
 * La oportunidad nace en la primera etapa (Nuevo), con el texto de la consulta
 * en las notas y el mensaje marcado como "contactado", que es lo que el
 * operador iba a hacer a mano dos pantallas después.
 *
 * Si el mensaje todavía no tiene ficha de cliente asociada (`contact_id` en
 * null, que pasa cuando el alta automática de la fase 7 falló), se crea acá.
 */
export async function createDealFromMessage(messageId: string): Promise<{ dealId: string }> {
  const supabase = await requireAuth();

  const { data: msg, error: msgError } = await supabase
    .from("contact_messages")
    .select("id, name, company, email, phone, message, contact_id")
    .eq("id", messageId)
    .single();
  if (msgError || !msg) throw new Error(msgError?.message ?? "No se encontró el mensaje.");

  let contactId = msg.contact_id as string | null;

  if (!contactId) {
    // Se busca por email antes de crear: el mismo mail puede haber entrado por
    // otra vía y duplicar la ficha sería peor que no tenerla.
    const { data: existing } = await supabase
      .from("crm_contacts")
      .select("id")
      .eq("email", msg.email)
      .limit(1)
      .maybeSingle();

    if (existing) {
      contactId = existing.id;
    } else {
      const { data: created, error: createError } = await supabase
        .from("crm_contacts")
        .insert({
          email: msg.email,
          phone: msg.phone,
          contact_name: msg.name,
          business_name: msg.company,
          origin: "formulario",
          enrichment_status: "skipped",
        })
        .select("id")
        .single();
      if (createError || !created) {
        throw new Error(createError?.message ?? "No se pudo crear la ficha del cliente.");
      }
      contactId = created.id;
    }
    await supabase.from("contact_messages").update({ contact_id: contactId }).eq("id", msg.id);
  }

  const { data: stage, error: stageError } = await supabase
    .from("pipeline_stages")
    .select("id")
    .order("order_index")
    .limit(1)
    .single();
  if (stageError || !stage) throw new Error("No hay etapas configuradas en el pipeline.");

  const { data: deal, error: dealError } = await supabase
    .from("pipeline_deals")
    .insert({
      contact_id: contactId,
      stage_id: stage.id,
      title: msg.company?.trim() || msg.name,
      notes: msg.message,
    })
    .select("id")
    .single();
  if (dealError || !deal) throw new Error(dealError?.message ?? "No se pudo crear la oportunidad.");

  // El operador ya actuó sobre la consulta: no tiene sentido dejarla en "nuevo"
  // y obligarlo a volver a marcarla.
  await supabase
    .from("contact_messages")
    .update({ status: "contactado", updated_at: new Date().toISOString() })
    .eq("id", msg.id);

  revalidatePath("/admin/crm");
  revalidatePath("/admin/pipelines");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/dashboard");
  return { dealId: deal.id };
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

/**
 * Manda el correo de invitación. Se usa igual al invitar y al reenviar: en los
 * dos casos se emite un token nuevo, así que el link anterior deja de servir.
 */
async function issueInvitationEmail(opts: {
  invitationId: string;
  email: string;
  role: AdminRole;
  invitedBy: string | null;
  resent: boolean;
}) {
  const admin = createAdminClient();
  const token = generateToken();
  const expiresAt = invitationExpiry();

  const { error: tokenErr } = await admin
    .from("admin_invitations")
    .update({ token_hash: hashToken(token), expires_at: expiresAt })
    .eq("id", opts.invitationId);
  if (tokenErr) throw new Error(tokenErr.message);

  const { subject, html, text } = invitationEmail({
    email: opts.email,
    role: opts.role,
    url: invitationUrl(await siteOrigin(), token),
    expiresAt,
    invitedBy: opts.invitedBy,
    resent: opts.resent,
  });

  await sendEmail({ to: opts.email, subject, html, text });
}

export async function inviteMember(email: string, role: AdminRole) {
  const supabase = await requireAuth();
  const { data: { user } } = await supabase.auth.getUser();
  await requireRole(supabase, "admin");

  const normalizedEmail = email.trim().toLowerCase();
  const admin = createAdminClient();

  // Invitar a alguien que ya entra al panel no hace nada útil y confunde: el
  // camino para esa persona es cambiar el rol, no una invitación nueva.
  const existingUser = await findAuthUserByEmail(admin, normalizedEmail);
  if (existingUser) {
    const { data: member } = await admin
      .from("admin_members")
      .select("user_id")
      .eq("user_id", existingUser.id)
      .maybeSingle();
    if (member) throw new Error("Esa persona ya es miembro del panel.");
  }

  // Una sola invitación viva por casilla: si había otra pendiente, la nueva la
  // reemplaza (y su link queda muerto).
  await admin
    .from("admin_invitations")
    .delete()
    .eq("email", normalizedEmail)
    .is("accepted_at", null);

  const { data: invitation, error: inviteErr } = await admin
    .from("admin_invitations")
    .insert({ email: normalizedEmail, role, invited_by: user!.id })
    .select("id")
    .single();
  if (inviteErr) throw new Error(inviteErr.message);

  try {
    await issueInvitationEmail({
      invitationId: invitation.id,
      email: normalizedEmail,
      role,
      invitedBy: user!.email ?? null,
      resent: false,
    });
  } catch (err) {
    // Una invitación sin correo es una fila que no sirve para nada y que
    // encima bloquea el reintento: se borra y se avisa el error real.
    await admin.from("admin_invitations").delete().eq("id", invitation.id);
    throw new Error(
      `No se pudo enviar el correo: ${err instanceof Error ? err.message : "error desconocido"}`
    );
  }

  revalidatePath("/admin/miembros");
}

/**
 * Reenvía una invitación pendiente con un link nuevo. Es la salida cuando el
 * link venció, se perdió en spam o el filtro de la casilla se lo comió.
 */
export async function resendInvitation(id: string) {
  const supabase = await requireAuth();
  const { data: { user } } = await supabase.auth.getUser();
  await requireRole(supabase, "admin");

  const admin = createAdminClient();
  const { data: invitation, error } = await admin
    .from("admin_invitations")
    .select("id, email, role, accepted_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!invitation) throw new Error("Esa invitación ya no existe.");
  if (invitation.accepted_at) throw new Error("Esa invitación ya fue aceptada.");

  await issueInvitationEmail({
    invitationId: invitation.id,
    email: invitation.email,
    role: invitation.role as AdminRole,
    invitedBy: user!.email ?? null,
    resent: true,
  });

  revalidatePath("/admin/miembros");
}

export async function cancelInvitation(id: string) {
  const supabase = await requireAuth();
  await requireRole(supabase, "admin");
  const { error } = await supabase.from("admin_invitations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}

/**
 * Nadie puede dejar la cuenta sin dueño.
 *
 * Es el único rol que puede administrar miembros, así que quedarse sin ninguno
 * deja la cuenta administrativamente muerta: no habría forma de invitar a nadie
 * ni de recuperar el permiso desde el panel. La barrera va en el servidor y no
 * en el botón, porque el botón se puede saltear.
 */
async function assertNotLastOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<void> {
  const { data: target } = await supabase
    .from("admin_members")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (target?.role !== "owner") return;

  const { count } = await supabase
    .from("admin_members")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "owner");
  if ((count ?? 0) <= 1) {
    throw new Error(
      "Es el único dueño de la cuenta. Nombrá a otra persona dueño antes de cambiarle el rol o quitarlo."
    );
  }
}

export async function updateMemberRole(userId: string, role: AdminRole) {
  const supabase = await requireAuth();
  await requireRole(supabase, "admin");
  if (role !== "owner") await assertNotLastOwner(supabase, userId);
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
  await assertNotLastOwner(supabase, userId);
  const { error } = await supabase.from("admin_members").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/miembros");
}

/**
 * Completa la invitación: la llama /admin/join cuando la persona manda la
 * contraseña. Acá — y no al abrir el link — es donde el token se consume.
 *
 * Es una acción pública a propósito: quien la llama todavía no tiene sesión.
 * Lo que la protege es el token, que solo está en el correo.
 */
export async function acceptInvitation(
  token: string,
  password: string
): Promise<{ email: string }> {
  const invalid = validatePassword(password);
  if (invalid) throw new Error(invalid);

  const found = await lookupInvitation(token);
  if (found.status === "expired") {
    throw new Error("La invitación venció. Pedile a un admin que te la mande de nuevo.");
  }
  if (found.status === "used") {
    throw new Error("Esta invitación ya se usó. Entrá con tu email y contraseña.");
  }
  if (found.status !== "ok") {
    throw new Error("El link no es válido. Pedile a un admin que te mande una invitación nueva.");
  }

  const admin = createAdminClient();

  // El usuario de Auth puede existir de antes (invitaciones del flujo viejo de
  // Supabase, que creaban el usuario al mandar el mail). Si existe se le setea
  // la contraseña; si no, se crea ya confirmado — el mail de invitación es la
  // prueba de que la casilla es suya.
  const existing = await findAuthUserByEmail(admin, found.email);
  let userId: string;
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    userId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: found.email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    userId = data.user.id;
  }

  const { error: memberErr } = await admin
    .from("admin_members")
    .upsert(
      { user_id: userId, role: found.role, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (memberErr) throw new Error(memberErr.message);

  // token_hash a NULL: un solo uso.
  await admin
    .from("admin_invitations")
    .update({ accepted_at: new Date().toISOString(), token_hash: null })
    .eq("id", found.id);

  revalidatePath("/admin/miembros");
  return { email: found.email };
}

/**
 * "Olvidé mi contraseña": manda el link de recuperación.
 *
 * Nunca dice si la casilla existe o no — ni con el valor de retorno ni con un
 * error. Si lo dijera, el formulario sería una forma cómoda de averiguar quién
 * tiene acceso al panel. La pantalla muestra siempre el mismo mensaje.
 *
 * Acción pública: la usa gente sin sesión, que es todo el punto.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return;

  const admin = createAdminClient();

  // Solo para miembros del panel: un usuario de Auth sin fila en
  // admin_members no tiene nada que recuperar.
  const user = await findAuthUserByEmail(admin, normalized);
  if (!user) return;
  const { data: member } = await admin
    .from("admin_members")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return;

  // Freno: apretar el botón diez veces no manda diez correos, y nadie puede
  // usar el formulario para inundarle la bandeja a otro.
  const { data: recent } = await admin
    .from("admin_password_resets")
    .select("created_at")
    .eq("email", normalized)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (
    recent &&
    Date.now() - new Date(recent.created_at).getTime() < RESET_THROTTLE_SECONDS * 1000
  ) {
    return;
  }

  // Un solo link vivo por casilla: el nuevo mata a los anteriores.
  await admin
    .from("admin_password_resets")
    .delete()
    .eq("email", normalized)
    .is("used_at", null);

  const token = generateToken();
  const expiresAt = resetExpiry();
  const { data: row, error } = await admin
    .from("admin_password_resets")
    .insert({
      user_id: user.id,
      email: normalized,
      token_hash: hashToken(token),
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { subject, html, text } = passwordResetEmail({
    email: normalized,
    url: resetUrl(await siteOrigin(), token),
    expiresAt,
  });

  try {
    await sendEmail({ to: normalized, subject, html, text });
  } catch (err) {
    // El pedido no sirve para nada si el correo no salió: se borra, así el
    // freno de un minuto no bloquea el próximo intento.
    await admin.from("admin_password_resets").delete().eq("id", row.id);

    // Un problema de configuración (dominio caído, key vencida) no dice nada
    // sobre el destinatario — no habría salido para nadie — así que se muestra
    // en pantalla. Si quedara mudo, la persona esperaría para siempre un
    // correo que no está saliendo. El resto de los errores sí se traga: ahí el
    // silencio es lo que evita revelar si la casilla existe.
    if (err instanceof EmailConfigError) throw err;
    console.error("password reset email error:", err);
  }
}

/**
 * Consuma el link de recuperación y deja la contraseña nueva.
 * Pública, igual que `acceptInvitation`: lo que la protege es el token.
 */
export async function resetPassword(
  token: string,
  password: string
): Promise<{ email: string }> {
  const invalid = validatePassword(password);
  if (invalid) throw new Error(invalid);

  const found = await lookupPasswordReset(token);
  if (found.status === "expired") {
    throw new Error("El link venció. Pedí uno nuevo desde “Olvidé mi contraseña”.");
  }
  if (found.status === "used") {
    throw new Error("Este link ya se usó. Entrá con tu contraseña nueva.");
  }
  if (found.status !== "ok") {
    throw new Error("El link no es válido. Pedí uno nuevo desde “Olvidé mi contraseña”.");
  }

  // ¿Es la misma contraseña que ya tenía? Acá no la conocemos —el link de
  // recuperación no la pide— pero se puede averiguar sin verla: si con la
  // "nueva" ya se puede entrar, es la de antes. Recuperar la clave y dejar la
  // misma no es recuperar nada.
  const check = createCredentialsClient();
  const { error: sameErr } = await check.auth.signInWithPassword({
    email: found.email,
    password,
  });
  if (!sameErr) {
    // Scope local: cierra solo la sesión que se acaba de crear acá.
    await check.auth.signOut({ scope: "local" });
    throw new Error("Esa es la contraseña que ya tenías. Elegí una distinta.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(found.userId, {
    password,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);

  await admin
    .from("admin_password_resets")
    .update({ used_at: new Date().toISOString() })
    .eq("id", found.id);

  // Si había otros links vivos de la misma casilla, mueren acá.
  await admin
    .from("admin_password_resets")
    .delete()
    .eq("email", found.email)
    .is("used_at", null);

  return { email: found.email };
}

/**
 * Cambio de contraseña de la propia cuenta, desde /admin/cuenta.
 *
 * Pide la contraseña actual aunque haya sesión: si no, cualquiera que agarre
 * la máquina desbloqueada se queda con la cuenta.
 */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const supabase = await requireAuth();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("No autorizado");

  const invalid = validatePassword(newPassword);
  if (invalid) throw new Error(invalid);
  if (newPassword === currentPassword) {
    throw new Error("La contraseña nueva tiene que ser distinta de la actual.");
  }

  // Cliente aparte, sin cookies: verificar acá con el cliente de sesión
  // rotaría los tokens del navegador en medio del pedido.
  const check = createCredentialsClient();
  const { error: signInErr } = await check.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInErr) throw new Error("La contraseña actual no es correcta.");

  // Verificar deja abierta la sesión que se acaba de crear: se cierra. Scope
  // "local" a propósito — el default de supabase-js es "global", que cerraría
  // también la sesión del navegador de la persona.
  await check.auth.signOut({ scope: "local" });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });
  if (error) throw new Error(error.message);
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

/**
 * Las conversaciones de la Bandeja: **solo las de la línea oficial**.
 *
 * Éste es el único lugar donde se separan los dos mundos de WhatsApp, y por eso
 * el filtro vive acá y no repartido por la pantalla. Las líneas de los
 * vendedores (Baileys) usan las mismas tablas —para que la línea de tiempo del
 * cliente pueda mostrar todo junto— pero no se operan desde la plataforma: sus
 * conversaciones se leen en la ficha del cliente, no acá.
 *
 * El `!inner` no es decorativo: sin él, una conversación sin línea asignada se
 * colaría en la Bandeja.
 */
export async function listConversations(): Promise<CrmConversation[]> {
  const supabase = await requireAuth();
  const { data, error } = await supabase
    .from("crm_conversations")
    .select("*, contact:crm_contacts(*), line:wa_lines!inner(id, name, kind)")
    .eq("line.kind", "meta")
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

/**
 * Responder en una conversación abierta.
 *
 * Ya no manda nada por su cuenta: delega en `sendOutreach`, que es el único
 * camino de envío del sistema. Antes había dos —éste y el del contacto en
 * frío— y solo uno de los dos miraba la ventana de 24 h de Meta y el tope
 * diario, así que contestar desde la Bandeja se salteaba las dos cosas.
 *
 * Se conserva la firma por `conversationId` porque es lo que tiene a mano
 * quien está mirando un hilo; adentro se resuelve el contacto.
 */
export async function sendCrmReply(conversationId: string, text: string): Promise<void> {
  const supabase = await requireAuth();

  const { data: conversation, error } = await supabase
    .from("crm_conversations")
    .select("contact_id")
    .eq("id", conversationId)
    .single();
  if (error || !conversation) throw new Error("Conversación no encontrada");

  await sendOutreach({ contactId: conversation.contact_id, text, conversationId });
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
  website?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  linkedin_url?: string | null;
  address?: string | null;
  rubro?: string | null;
  locality?: string | null;
  google_maps_url?: string | null;
}

/**
 * Campos que también escribe algún proceso automático (`upsert_prospect` o el
 * enriquecedor). Tocar cualquiera de estos congela la ficha.
 *
 * El caso que lo justifica no es que te sobrescriban un dato —el enriquecedor
 * solo completa lo que está vacío, así que un valor cargado a mano ya se
 * defiende solo— sino **borrar**: si alguien saca un teléfono equivocado, sin
 * el candado la próxima corrida lo vuelve a poner. El mismo teléfono
 * equivocado.
 */
const DISPUTED_FIELDS = [
  "business_name",
  "contact_name",
  "email",
  "phone",
  "whatsapp_phone",
  "website",
  "instagram_url",
  "facebook_url",
  "linkedin_url",
  "address",
  "rubro",
  "locality",
] as const satisfies readonly (keyof ClientEdit)[];

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
  // RLS es la última línea de defensa; esto da un error legible antes.
  await requireRole(supabase, "agent");

  const clean = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);

  // Lista blanca explícita, nunca `...data`: `contact_tier` es una columna
  // GENERATED y mandarla revienta el UPDATE, y `enrichment_*`, `outreach_*` y
  // `google_place_id` no son editables a mano.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("business_name" in data) patch.business_name = clean(data.business_name);
  if ("contact_name" in data) patch.contact_name = clean(data.contact_name);
  if ("email" in data) patch.email = clean(data.email)?.toLowerCase() ?? null;
  if ("address" in data) patch.address = clean(data.address);
  if ("rubro" in data) patch.rubro = clean(data.rubro);
  if ("locality" in data) patch.locality = clean(data.locality);

  // Las URLs se normalizan igual que los teléfonos. Un `instagram.com/comercio`
  // sin `https://` metido en un `href` queda relativo y manda a
  // /admin/clientes/instagram.com/comercio en vez de al perfil.
  for (const field of ["website", "instagram_url", "facebook_url", "linkedin_url", "google_maps_url"] as const) {
    if (!(field in data)) continue;
    const raw = clean(data[field]);
    if (!raw) {
      patch[field] = null;
      continue;
    }
    const classified = classifyUrl(raw);
    if (!classified.url) throw new Error(`No se pudo interpretar la dirección "${raw}"`);
    patch[field] = classified.url;
  }

  // Los teléfonos se normalizan al formato que usa el resto del sistema
  // (dígitos sin '+'). Si no se pueden interpretar se avisa en vez de guardar
  // un número corrompido.
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

  // Solo congela si se tocó un campo que un proceso automático también
  // escribe. Y nunca baja el candado por omisión: para eso está
  // `unfreezeClient`, que además devuelve la ficha a la cola.
  const touchedDisputed = DISPUTED_FIELDS.some((f) => f in data);
  if (touchedDisputed) patch.manual_lock = true;

  // El "antes" hace falta para que el evento diga algo útil: sin él, el
  // registro sería "alguien editó algo" y no serviría para nada.
  const { data: before } = await supabase
    .from("crm_contacts")
    .select(Object.keys(patch).filter((k) => k !== "updated_at").join(","))
    .eq("id", id)
    .single();

  const { error } = await supabase.from("crm_contacts").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  await logClientEdit(id, before as Record<string, unknown> | null, patch);

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/pipelines");
}

/**
 * Deja constancia de la edición en la línea de tiempo.
 *
 * Con la service key porque la política de INSERT de `crm_events` solo acepta
 * `kind='note'`: los eventos de sistema no se pueden fabricar desde una sesión
 * de usuario, y este lo es. Un fallo acá no revierte la edición — el dato ya
 * se guardó y perder el registro es menos malo que perder el cambio.
 */
async function logClientEdit(
  contactId: string,
  before: Record<string, unknown> | null,
  patch: Record<string, unknown>
): Promise<void> {
  const fields = Object.keys(patch).filter(
    (k) => k !== "updated_at" && k !== "manual_lock" && before?.[k] !== patch[k]
  );
  if (fields.length === 0) return;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const admin = createAdminClient();
    await admin.from("crm_events").insert({
      contact_id: contactId,
      kind: "edited",
      body: fields.join(", "),
      meta: {
        fields,
        before: Object.fromEntries(fields.map((f) => [f, before?.[f] ?? null])),
        after: Object.fromEntries(fields.map((f) => [f, patch[f] ?? null])),
      },
      actor_member_id: user?.id ?? null,
    });
  } catch (err) {
    console.error("[updateClient] no se pudo registrar la edición:", err);
  }
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
