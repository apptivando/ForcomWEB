/**
 * Contacto en frío: escribirle desde la plataforma a alguien que nunca nos
 * escribió.
 *
 * ─── La ventana de 24 horas ───────────────────────────────────────────────
 * Es la regla que ordena todo este módulo. Con una conexión oficial a Meta
 * (WhatsApp Cloud API) se puede mandar texto libre SOLO dentro de las 24 horas
 * posteriores al último mensaje **del cliente**. Fuera de esa ventana —o sea,
 * en todo contacto en frío— Meta únicamente acepta plantillas que haya
 * aprobado de antemano.
 *
 * Hoy el transporte es Evolution, que al no ser oficial no aplica esa regla:
 * técnicamente deja mandar cualquier cosa a cualquiera. Igual se calcula y se
 * muestra la ventana, por dos razones: le avisa al operador cuándo está
 * haciendo algo que Meta no permitiría, y hace que migrar a Meta no cambie el
 * comportamiento de la pantalla, solo el transporte.
 *
 * ─── Por qué hay un tope diario ───────────────────────────────────────────
 * Mandar mensajes en frío desde el número de la empresa es el patrón exacto
 * que hace que WhatsApp limite o bloquee una línea. El tope no es burocracia:
 * es lo que evita que un día de entusiasmo deje al negocio sin WhatsApp.
 *
 * Server-only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendText } from "@/lib/evolution";
import type { CrmContact, OutreachTemplate } from "@/lib/types";

/** Ventana de atención de Meta, en milisegundos. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type OutreachTransport = "evolution" | "meta";

export function currentTransport(): OutreachTransport {
  return process.env.WHATSAPP_TRANSPORT?.trim().toLowerCase() === "meta" ? "meta" : "evolution";
}

export function dailyColdLimit(): number {
  const raw = Number(process.env.OUTREACH_DAILY_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? raw : 20;
}

export interface WindowState {
  /** Se puede mandar texto libre sin plantilla. */
  open: boolean;
  /** Último mensaje entrante, o null si nunca escribió. */
  lastInboundAt: string | null;
  /** Horas que faltan para que se cierre. Null si ya está cerrada. */
  hoursLeft: number | null;
  /** Nunca hubo un mensaje entrante: es un contacto en frío de verdad. */
  neverContacted: boolean;
}

/**
 * Estado de la ventana de 24 h para un contacto.
 * Se calcula desde `crm_messages` en vez de guardarse en una columna porque
 * el dato ya está ahí y una columna derivada se desincroniza sola.
 */
export async function getWindowState(
  supabase: SupabaseClient,
  contactId: string
): Promise<WindowState> {
  const { data } = await supabase
    .from("crm_messages")
    .select("created_at, conversation:crm_conversations!inner(contact_id)")
    .eq("conversation.contact_id", contactId)
    .eq("direction", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastInboundAt = (data as { created_at?: string } | null)?.created_at ?? null;
  if (!lastInboundAt) {
    return { open: false, lastInboundAt: null, hoursLeft: null, neverContacted: true };
  }

  const elapsed = Date.now() - new Date(lastInboundAt).getTime();
  const open = elapsed < SERVICE_WINDOW_MS;
  return {
    open,
    lastInboundAt,
    hoursLeft: open ? Math.max(0, Math.round((SERVICE_WINDOW_MS - elapsed) / 3_600_000)) : null,
    neverContacted: false,
  };
}

/**
 * Rellena los marcadores {{1}}, {{2}}… de una plantilla con los datos de la
 * ficha. Es el mismo esquema de marcadores que usa Meta, así que el mismo
 * cuerpo sirve para las dos vías.
 *
 * Los valores salen de `variables`, que describe qué representa cada marcador.
 * Si un dato falta, el marcador se reemplaza por vacío en vez de dejar un
 * "{{1}}" crudo a la vista del cliente — que es el peor resultado posible.
 */
export function renderTemplate(template: OutreachTemplate, contact: CrmContact): string {
  const values = template.variables.map((variable) => {
    const key = variable.toLowerCase();
    if (key.includes("contacto") || key.includes("persona")) {
      // El saludo suele escribirse "Hola{{1}}," — por eso el espacio va
      // adelante y no en la plantilla: sin nombre queda "Hola," y no "Hola ,".
      return contact.contact_name ? ` ${contact.contact_name}` : "";
    }
    if (key.includes("razón") || key.includes("razon") || key.includes("empresa") || key.includes("comercio")) {
      return contact.business_name ?? "";
    }
    if (key.includes("rubro")) return contact.rubro ?? "";
    if (key.includes("localidad") || key.includes("ciudad")) return contact.locality ?? "";
    return "";
  });

  return template.body.replace(/\{\{(\d+)\}\}/g, (_, n) => values[Number(n) - 1] ?? "");
}

export class OutreachBlocked extends Error {
  readonly kind: "quota" | "window" | "no-phone" | "already" | "transport";

  constructor(kind: OutreachBlocked["kind"], message: string) {
    super(message);
    this.name = "OutreachBlocked";
    this.kind = kind;
  }
}

/**
 * Manda un mensaje por el transporte configurado.
 *
 * Con `meta`, un texto libre fuera de la ventana se rechaza ACÁ, antes de
 * salir a la red: es lo que Meta haría igual, pero avisando con un mensaje
 * entendible en vez de un error de API.
 */
export async function deliver(opts: {
  phone: string;
  text: string;
  isFreeform: boolean;
  windowOpen: boolean;
  template: OutreachTemplate | null;
}): Promise<{ waMessageId?: string }> {
  const transport = currentTransport();

  if (transport === "meta") {
    if (opts.isFreeform && !opts.windowOpen) {
      throw new OutreachBlocked(
        "window",
        "Con la conexión oficial de Meta no se puede mandar texto libre fuera de la ventana de 24 h. Elegí una plantilla aprobada."
      );
    }
    if (!opts.isFreeform && opts.template?.status !== "aprobada") {
      throw new OutreachBlocked(
        "window",
        `La plantilla "${opts.template?.name ?? "—"}" no está aprobada por Meta todavía.`
      );
    }
    throw new OutreachBlocked(
      "transport",
      "El transporte Meta todavía no está implementado. Configurá WHATSAPP_TRANSPORT=evolution o completá la integración con la Cloud API."
    );
  }

  const result = await sendText(opts.phone, opts.text);
  return { waMessageId: result?.key?.id };
}
