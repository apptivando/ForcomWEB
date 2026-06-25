"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { HeroContent, HeroSlide, Product } from "@/lib/types";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return supabase;
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

export async function upsertProduct(data: Partial<Product> & { model: string }) {
  const supabase = await requireAuth();
  const payload = {
    model: data.model,
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
