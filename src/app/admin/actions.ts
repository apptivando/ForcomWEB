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
import type { HeroContent, HeroSlide, Product, CompanyInfo } from "@/lib/types";

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

/**
 * El slug de la URL pública de cada producto (`/productos/<slug>`).
 *
 * Se deriva del modelo y no se pide a mano: un campo más que llenar es un campo
 * más para dejar vacío, y un producto sin slug no tiene ficha — la tarjeta del
 * catálogo enlazaría a `/productos/null`.
 */
function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * El slug tiene que ser único: dos productos con modelos que se normalizan
 * igual chocarían en la misma URL. Al segundo se le agrega -2, -3…
 * `excludeId` evita que un producto choque consigo mismo al editarlo.
 */
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
 * Resultado de las acciones de contraseña (invitación, recuperación, cambio).
 *
 * POR QUÉ NO ALCANZA CON `throw`: estas acciones le hablan a una persona que
 * está mirando un formulario, y sus errores son parte de la conversación —
 * "esa es la contraseña que ya tenías", "el link venció"—. Next **borra el
 * mensaje de cualquier error que se tire desde una Server Action en el build
 * de producción** y lo reemplaza por "An error occurred in the Server
 * Components render...". En `next dev` el texto se ve, así que el problema no
 * aparece probando local: se ve recién en forcom.tech, y le aparece al usuario.
 * Pasó el 24/09/2026 al reusar una contraseña en /admin/recuperar.
 *
 * Por eso lo esperable se **devuelve** y solo lo inesperado se tira (ahí el
 * mensaje genérico está bien: no hay nada que la persona pueda hacer con él).
 */
export type PasswordActionResult = { ok: true } | { ok: false; error: string };

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
): Promise<PasswordActionResult> {
  const invalid = validatePassword(password);
  if (invalid) return { ok: false, error: invalid };

  const found = await lookupInvitation(token);
  if (found.status === "expired") {
    return { ok: false, error: "La invitación venció. Pedile a un admin que te la mande de nuevo." };
  }
  if (found.status === "used") {
    return { ok: false, error: "Esta invitación ya se usó. Entrá con tu email y contraseña." };
  }
  if (found.status !== "ok") {
    return {
      ok: false,
      error: "El link no es válido. Pedile a un admin que te mande una invitación nueva.",
    };
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
  return { ok: true };
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
export async function requestPasswordReset(email: string): Promise<PasswordActionResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return { ok: true };

  const admin = createAdminClient();

  // Solo para miembros del panel: un usuario de Auth sin fila en
  // admin_members no tiene nada que recuperar.
  const user = await findAuthUserByEmail(admin, normalized);
  if (!user) return { ok: true };
  const { data: member } = await admin
    .from("admin_members")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return { ok: true };

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
    return { ok: true };
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
    if (err instanceof EmailConfigError) {
      return { ok: false, error: `El correo no pudo salir: ${err.message}` };
    }
    console.error("password reset email error:", err);
  }

  return { ok: true };
}

/**
 * Consuma el link de recuperación y deja la contraseña nueva.
 * Pública, igual que `acceptInvitation`: lo que la protege es el token.
 */
export async function resetPassword(
  token: string,
  password: string
): Promise<PasswordActionResult> {
  const invalid = validatePassword(password);
  if (invalid) return { ok: false, error: invalid };

  const found = await lookupPasswordReset(token);
  if (found.status === "expired") {
    return { ok: false, error: "El link venció. Pedí uno nuevo desde “Olvidé mi contraseña”." };
  }
  if (found.status === "used") {
    return { ok: false, error: "Este link ya se usó. Entrá con tu contraseña nueva." };
  }
  if (found.status !== "ok") {
    return { ok: false, error: "El link no es válido. Pedí uno nuevo desde “Olvidé mi contraseña”." };
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
    return { ok: false, error: "Esa es la contraseña que ya tenías. Elegí una distinta." };
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

  return { ok: true };
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
): Promise<PasswordActionResult> {
  const supabase = await requireAuth();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("No autorizado");

  const invalid = validatePassword(newPassword);
  if (invalid) return { ok: false, error: invalid };
  if (newPassword === currentPassword) {
    return { ok: false, error: "La contraseña nueva tiene que ser distinta de la actual." };
  }

  // Cliente aparte, sin cookies: verificar acá con el cliente de sesión
  // rotaría los tokens del navegador en medio del pedido.
  const check = createCredentialsClient();
  const { error: signInErr } = await check.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInErr) return { ok: false, error: "La contraseña actual no es correcta." };

  // Verificar deja abierta la sesión que se acaba de crear: se cierra. Scope
  // "local" a propósito — el default de supabase-js es "global", que cerraría
  // también la sesión del navegador de la persona.
  await check.auth.signOut({ scope: "local" });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });
  if (error) throw new Error(error.message);

  return { ok: true };
}

