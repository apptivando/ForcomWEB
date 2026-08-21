"use server";

// Server Actions de las líneas de WhatsApp.
//
// Una línea de vendedor es una instancia de Evolution, que a su vez es un
// dispositivo vinculado al WhatsApp de esa persona — igual que WhatsApp Web.
// Conectar una es una acción sensible (queda registrado todo lo que se hable
// por ese número), así que va limitada a owner/admin.

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/roles";
import {
  createInstance,
  connectInstance,
  fetchInstances,
  logoutInstance,
  deleteInstance,
  type ConnectResult,
} from "@/lib/evolution";
import { toWhatsappNumber } from "@/lib/phone";
import type { WaLine } from "@/lib/types";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  await requireRole(supabase, "admin");
  return supabase;
}

/** El nombre de instancia se deriva del nombre de la línea: sin espacios ni acentos. */
function toInstanceName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `forcom-${slug || "linea"}`;
}

export async function listWaLines(): Promise<WaLine[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const { data, error } = await supabase
    .from("wa_lines")
    .select("*")
    .order("is_primary", { ascending: false })
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as WaLine[];
}

export interface CreateLineInput {
  name: string;
  memberId?: string | null;
  phone?: string | null;
}

/**
 * Da de alta una línea de vendedor: crea la instancia en Evolution con el
 * webhook ya apuntando acá, y guarda la fila.
 *
 * El webhook se configura al crear y no después, a mano, porque una instancia
 * conectada sin webhook recibe mensajes que no quedan registrados en ningún
 * lado — que es exactamente lo contrario de para qué existe esto.
 */
export async function createWaLine(input: CreateLineInput): Promise<WaLine> {
  const supabase = await requireAdmin();

  const name = input.name.trim();
  if (!name) throw new Error("La línea necesita un nombre");

  const instance = toInstanceName(name);
  const phone = input.phone?.trim() ? toWhatsappNumber(input.phone) : null;
  if (input.phone?.trim() && !phone) {
    throw new Error(`No se pudo interpretar el número "${input.phone}"`);
  }

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const token = process.env.EVOLUTION_WEBHOOK_TOKEN;
  if (!token) throw new Error("Falta EVOLUTION_WEBHOOK_TOKEN en el entorno");

  // Primero la fila: si Evolution falla, no queda una instancia huérfana
  // recibiendo mensajes que nadie guarda.
  const { data: line, error } = await supabase
    .from("wa_lines")
    .insert({
      name,
      kind: "baileys",
      instance,
      phone,
      member_id: input.memberId || null,
      active: true,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error(`Ya existe una línea llamada "${name}"`);
    throw new Error(error.message);
  }

  try {
    await createInstance({
      instanceName: instance,
      webhookUrl: `${origin}/api/whatsapp/evolution`,
      webhookToken: token,
    });
  } catch (err) {
    // Si Evolution no la pudo crear, la fila no sirve para nada: se borra para
    // no dejar una línea fantasma en la pantalla.
    await supabase.from("wa_lines").delete().eq("id", line.id);
    throw new Error(
      `Evolution no pudo crear la instancia: ${err instanceof Error ? err.message : "error desconocido"}`
    );
  }

  revalidatePath("/admin/lineas");
  return line as WaLine;
}

export interface LineQr extends ConnectResult {
  /** Evolution respondió pero sin QR — pasa en algunas versiones. */
  empty: boolean;
}

/**
 * Pide el QR para vincular el teléfono.
 *
 * Hay versiones de Evolution donde este endpoint devuelve una respuesta vacía
 * aunque el Manager sí muestre el QR. En vez de dejar la pantalla cargando para
 * siempre, se devuelve `empty: true` y la pantalla ofrece abrir el Manager.
 */
export async function getLineQr(lineId: string): Promise<LineQr> {
  const supabase = await requireAdmin();
  const { data: line } = await supabase
    .from("wa_lines")
    .select("instance")
    .eq("id", lineId)
    .single();
  if (!line?.instance) throw new Error("Esta línea no tiene instancia de Evolution");

  const result = await connectInstance(line.instance);
  return { ...result, empty: !result?.base64 && !result?.code && !result?.pairingCode };
}

/** Pregunta a Evolution el estado real de cada línea y lo guarda. */
export async function refreshLineStates(): Promise<WaLine[]> {
  const supabase = await requireAdmin();

  let remote: Awaited<ReturnType<typeof fetchInstances>> = [];
  try {
    remote = await fetchInstances();
  } catch (err) {
    throw new Error(
      `No se pudo consultar Evolution: ${err instanceof Error ? err.message : "error desconocido"}`
    );
  }

  const byInstance = new Map(remote.map((r) => [r.instanceName, r]));
  const { data: lines } = await supabase.from("wa_lines").select("id, instance");

  const now = new Date().toISOString();
  await Promise.all(
    (lines ?? [])
      .filter((l) => l.instance)
      .map((l) =>
        supabase
          .from("wa_lines")
          // `close` cuando Evolution no la conoce: una instancia que
          // desapareció del servidor no está conectada, y decir "sin datos"
          // sería más confuso que decir que está caída.
          .update({ conn_state: byInstance.get(l.instance!)?.state ?? "close", conn_checked_at: now })
          .eq("id", l.id)
      )
  );

  revalidatePath("/admin/lineas");
  return listWaLines();
}

/** Cierra la sesión del teléfono sin borrar la línea: se puede volver a escanear. */
export async function disconnectWaLine(lineId: string): Promise<void> {
  const supabase = await requireAdmin();
  const { data: line } = await supabase
    .from("wa_lines")
    .select("instance")
    .eq("id", lineId)
    .single();
  if (line?.instance) {
    try {
      await logoutInstance(line.instance);
    } catch {
      // Si ya estaba desconectada, Evolution devuelve error y está bien.
    }
  }
  await supabase.from("wa_lines").update({ conn_state: "close" }).eq("id", lineId);
  revalidatePath("/admin/lineas");
}

/**
 * Borra la línea y su instancia. **No borra lo ya registrado**: las
 * conversaciones quedan, con `line_id` en null. Perder el historial de un
 * cliente porque se dio de baja a un vendedor sería el peor efecto posible.
 */
export async function deleteWaLine(lineId: string): Promise<void> {
  const supabase = await requireAdmin();
  const { data: line } = await supabase
    .from("wa_lines")
    .select("instance, is_primary")
    .eq("id", lineId)
    .single();
  if (line?.is_primary) throw new Error("La línea principal no se puede borrar");

  if (line?.instance) {
    try {
      await deleteInstance(line.instance);
    } catch {
      // Que Evolution no la encuentre no debería impedir limpiar de este lado.
    }
  }
  await supabase.from("wa_lines").delete().eq("id", lineId);
  revalidatePath("/admin/lineas");
}

export async function updateWaLine(
  lineId: string,
  data: { name?: string; memberId?: string | null; active?: boolean }
): Promise<void> {
  const supabase = await requireAdmin();
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.memberId !== undefined) patch.member_id = data.memberId || null;
  if (data.active !== undefined) patch.active = data.active;

  const { error } = await supabase.from("wa_lines").update(patch).eq("id", lineId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/lineas");
}

/**
 * Excluye un número por ser personal y borra todo lo que se registró de él.
 *
 * Borrar y no solo dejar de registrar: lo que se guardó antes de darse cuenta
 * de que la conversación era personal sigue siendo una conversación personal
 * guardada. La exclusión vive en su propia tabla justamente para sobrevivir a
 * ese borrado — si fuera un campo del contacto, se iría con él y el próximo
 * mensaje volvería a crear la ficha.
 */
export async function excludeNumber(
  phone: string,
  reason?: string
): Promise<{ contacts: number; messages: number }> {
  const supabase = await requireAdmin();
  const normalized = toWhatsappNumber(phone) ?? phone.replace(/\D/g, "");

  const { data, error } = await supabase.rpc("exclude_and_purge_number", {
    p_phone: normalized,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/admin/lineas");
  revalidatePath("/admin/clientes");
  return { contacts: row?.contacts_deleted ?? 0, messages: row?.messages_deleted ?? 0 };
}
