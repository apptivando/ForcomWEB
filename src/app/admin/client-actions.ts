"use server";

// Server Actions de la ficha de cliente: la línea de tiempo, las notas
// internas y las oportunidades de un contacto.
//
// En su propio archivo porque `actions.ts` ya pasó las 1.200 líneas y esto es
// un dominio con reglas propias — sobre todo las de RLS de las notas, que son
// lo que impide que un agente edite la nota de otro.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CrmContact, CrmEvent, PipelineDeal, TimelineItem } from "@/lib/types";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  return { supabase, user };
}

// ─── Línea de tiempo ─────────────────────────────────────────────────────────

// Cuántos ítems por página. Sin exportar: un módulo "use server" solo puede
// exportar funciones async, y una constante ahí rompe el build.
const TIMELINE_PAGE_SIZE = 40;

export interface TimelinePage {
  items: TimelineItem[];
  /** Hay más para atrás: el botón "ver más" se muestra según esto. */
  hasMore: boolean;
}

/**
 * La historia completa de un cliente, mezclando WhatsApp, formulario web,
 * movimientos del Pipeline, de qué búsqueda salió y las notas del equipo.
 *
 * Una sola llamada a Postgres y no cuatro consultas en paralelo: mezclando en
 * JS, la primera página sale bien y la segunda se rompe — un cliente con 500
 * mensajes de WhatsApp taparía el mensaje del formulario de hace un año,
 * porque el tope de esa fuente se agota antes de llegar. Ver la función
 * `contact_timeline` en la migración 012.
 *
 * `before` es la fecha del último ítem que ya se mostró. Cursor y no OFFSET:
 * con OFFSET, un mensaje que entra mientras se pagina corre todo un lugar y
 * repite una fila.
 */
export async function getClientTimeline(
  contactId: string,
  before?: string
): Promise<TimelinePage> {
  const { supabase } = await requireAuth();

  const { data, error } = await supabase.rpc("contact_timeline", {
    p_contact_id: contactId,
    p_before: before ?? null,
    p_limit: TIMELINE_PAGE_SIZE + 1,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as TimelineItem[];
  const hasMore = rows.length > TIMELINE_PAGE_SIZE;
  return { items: hasMore ? rows.slice(0, TIMELINE_PAGE_SIZE) : rows, hasMore };
}

// ─── Notas internas ──────────────────────────────────────────────────────────

/**
 * Las notas se insertan siempre a nombre de quien las escribe: la política de
 * RLS exige `actor_member_id = auth.uid()`, así que mandar otro id no falla en
 * silencio, falla de verdad.
 */
export async function addClientNote(contactId: string, body: string): Promise<void> {
  const { supabase, user } = await requireAuth();
  const text = body.trim();
  if (!text) throw new Error("La nota está vacía");

  const { error } = await supabase.from("crm_events").insert({
    contact_id: contactId,
    kind: "note",
    body: text,
    actor_member_id: user.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/clientes");
}

/**
 * Editar una nota. Quién puede hacerlo lo decide RLS —el autor o un
 * owner/admin—, no un `if` de pantalla: esconder el botón no impide que
 * alguien llame la acción igual.
 */
export async function updateClientNote(id: string, body: string): Promise<void> {
  const { supabase } = await requireAuth();
  const text = body.trim();
  if (!text) throw new Error("La nota está vacía");

  const { data, error } = await supabase
    .from("crm_events")
    .update({ body: text })
    .eq("id", id)
    .eq("kind", "note")
    .select("id");
  if (error) throw new Error(error.message);
  // Con RLS, un UPDATE no permitido no da error: simplemente afecta 0 filas.
  if (!data || data.length === 0) throw new Error("No se pudo editar la nota");

  revalidatePath("/admin/clientes");
}

export async function deleteClientNote(id: string): Promise<void> {
  const { supabase } = await requireAuth();

  const { data, error } = await supabase
    .from("crm_events")
    .delete()
    .eq("id", id)
    .eq("kind", "note")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("No se pudo borrar la nota");

  revalidatePath("/admin/clientes");
}

/** Las notas de un contacto, para poder resolver autor y permisos en la UI. */
export async function listClientNotes(contactId: string): Promise<CrmEvent[]> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("crm_events")
    .select("*")
    .eq("contact_id", contactId)
    .eq("kind", "note")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CrmEvent[];
}

// ─── Oportunidades del contacto ──────────────────────────────────────────────

/**
 * Las oportunidades de UN cliente. `listPipelineDeals` trae todas las del
 * sistema con el contacto embebido, que para una ficha es traer de más y
 * además el contacto ya lo tenemos.
 */
export async function listContactDeals(contactId: string): Promise<PipelineDeal[]> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("pipeline_deals")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PipelineDeal[];
}

// ─── El candado ──────────────────────────────────────────────────────────────

/**
 * Descongela una ficha y la devuelve a la cola de enriquecimiento.
 *
 * Hace falta porque el candado no tenía salida: corregías un email y esa ficha
 * no se volvía a enriquecer nunca, aunque le faltaran el teléfono y las redes.
 * Bajar `manual_lock` sin volver a encolar tampoco alcanzaría — el enriquecedor
 * solo toma las que están en `pending`.
 */
export async function unfreezeClient(id: string): Promise<void> {
  const { supabase } = await requireAuth();
  const { error } = await supabase
    .from("crm_contacts")
    .update({
      manual_lock: false,
      enrichment_status: "pending",
      enrichment_error: null,
      scrape_attempts: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/clientes");
}

/** La ficha completa, para refrescarla después de editar sin recargar la lista. */
export async function getClient(id: string): Promise<CrmContact> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase.from("crm_contacts").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Cliente no encontrado");
  return data as CrmContact;
}
