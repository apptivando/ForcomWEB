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
interface TemplateValue {
  value: string;
  /**
   * El mensaje sigue estando bien escrito si este marcador queda vacío.
   *
   * El caso que lo motiva: un prospecto que salió de Google **nunca** tiene
   * nombre de persona — Places da la razón social, no quién atiende. Si eso
   * contara como dato faltante, la advertencia saltaría en todos los
   * prospectos y dejaría de significar nada. Y no hace falta: el saludo se
   * escribe "Hola{{1}}," con el espacio del lado del valor justamente para que
   * sin nombre quede "Hola," y no "Hola ,".
   */
  optional: boolean;
}

function templateValues(template: OutreachTemplate, contact: CrmContact): TemplateValue[] {
  return template.variables.map((variable) => {
    const key = variable.toLowerCase();
    // Escape hatch para quien escribe la plantilla: describir la variable como
    // "algo (opcional)" la exime de la advertencia.
    const optional = key.includes("opcional");

    if (key.includes("contacto") || key.includes("persona")) {
      return { value: contact.contact_name ? ` ${contact.contact_name}` : "", optional: true };
    }
    if (key.includes("razón") || key.includes("razon") || key.includes("empresa") || key.includes("comercio")) {
      return { value: contact.business_name ?? "", optional };
    }
    if (key.includes("rubro")) return { value: contact.rubro ?? "", optional };
    if (key.includes("localidad") || key.includes("ciudad")) return { value: contact.locality ?? "", optional };
    return { value: "", optional };
  });
}

export function renderTemplate(template: OutreachTemplate, contact: CrmContact): string {
  const values = templateValues(template, contact);

  return (
    template.body
      .replace(/\{\{(\d+)\}\}/g, (_, n) => values[Number(n) - 1]?.value ?? "")
      // Un marcador que quedó vacío deja un hueco a la vista: "Vimos que
      // trabajan en  y quería…" con doble espacio, o un " ," colgado. Se
      // limpia solo lo que no altera el formato — corridas de espacios y
      // tabs, nunca saltos de línea, que son intencionales en la plantilla.
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+([,.;:!?])/g, "$1")
      .replace(/[ \t]+$/gm, "")
  );
}

/**
 * Marcadores que quedaron vacíos **y dejan la frase mal escrita**.
 *
 * Limpiar los espacios sobrantes disimula el hueco pero no arregla la
 * redacción: "Vimos que trabajan en y quería contarte" sigue estando mal. Por
 * eso la pantalla avisa antes de enviar, en vez de confiar en que alguien lea
 * la vista previa con atención.
 *
 * No entran los marcadores opcionales: un saludo sin nombre es correcto, y si
 * avisara por eso saltaría en todos los prospectos de Google —que nunca traen
 * nombre de persona— y la advertencia dejaría de significar algo.
 */
export function templateGaps(template: OutreachTemplate, contact: CrmContact): string[] {
  const values = templateValues(template, contact);
  const used = new Set([...template.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));

  return template.variables.filter(
    (_, i) => used.has(i + 1) && !values[i].optional && values[i].value.trim() === ""
  );
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
