/**
 * Análisis de las conversaciones de los vendedores.
 *
 * ─── Qué analiza la IA y qué no ───────────────────────────────────────────
 * Lo que se puede contar, se cuenta: cuánto tarda en responder y qué
 * conversaciones quedaron con la última palabra del cliente salen de mirar la
 * dirección y la fecha de los mensajes (`seller_stats` en la migración 014).
 * Es exacto, instantáneo y gratis.
 *
 * Acá queda solo lo que de verdad necesita leer: si contestó pero no respondió
 * lo que le preguntaron, las oportunidades que se dejaron pasar, y el tono.
 *
 * ─── Por qué no usa la API de lotes ───────────────────────────────────────
 * El plan decía Batches, que cuesta la mitad. Al implementarlo no se sostuvo:
 * son ~200 conversaciones por día, así que el ahorro real es de unos pocos
 * dólares al mes, y a cambio hay que mantener una máquina de estados
 * (enviar → esperar → recuperar) con su propia tabla. El proyecto ya tiene el
 * patrón de "reclamar N y procesarlos" andando en el enriquecedor de
 * prospectos; reusarlo es menos código, menos que puede fallar, y encaja con
 * el cron que ya corre.
 *
 * Si el volumen crece hasta que el ahorro importe, el cambio queda contenido
 * en este archivo: la cola y la tabla no se enteran.
 *
 * Server-only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/encryption";
import { generateReply } from "@/lib/ai/generate";

/** Cuántas conversaciones se analizan por corrida del cron. */
const DEFAULT_BATCH = 6;
/** Mensajes por conversación que se le mandan al modelo. */
const TRANSCRIPT_LIMIT = 60;

const SYSTEM_PROMPT = `Analizás conversaciones de WhatsApp entre un vendedor de FORCOM y un cliente.

FORCOM es un fabricante argentino de equipamiento para punto de venta: Smart POS, Mini PC, impresoras fiscales, lectores y verificadores de precio. Fabrica los equipos en el país, con repuestos y garantía directa. NO es revendedor ni distribuidor.

Tu trabajo es señalar cosas concretas y accionables, no calificar personas. Sé conservador: si algo no está claro en la conversación, no lo inventes ni lo supongas.

Devolvés SOLO un objeto JSON, sin texto alrededor y sin bloques de código, con esta forma exacta:

{
  "personal": false,
  "resumen": "una frase de qué se habló",
  "sin_responder": ["la consulta textual del cliente que quedó sin respuesta"],
  "oportunidades": ["qué se dejó pasar y qué se podría haber hecho"],
  "tono": { "nivel": "bien", "nota": "una frase, solo si hay algo que señalar" }
}

Reglas:
- "personal": true SOLO si la conversación no tiene nada que ver con el trabajo (familia, amigos, temas privados). Una charla cordial con un cliente NO es personal.
- "sin_responder": incluí una consulta solo si el cliente preguntó algo concreto y el vendedor no lo respondió, o respondió otra cosa. Si contestó, aunque sea brevemente, no va. Array vacío si no hay ninguna.
- "oportunidades": solo lo evidente — preguntó por un producto y no se le pasó precio ni se le ofreció cotizar, o la charla terminó sin ningún próximo paso. Array vacío si no hay nada claro.
- "tono": "nivel" es "bien", "regular" o "malo". Poné "regular" o "malo" solo ante algo concreto (cortante, confuso, demoras que el cliente reclama). Ante la duda, "bien" y "nota" vacía.`;

export interface ReviewFindings {
  personal: boolean;
  resumen: string;
  sin_responder: string[];
  oportunidades: string[];
  tono: { nivel: string; nota?: string } | null;
}

interface AiConfig {
  provider: "anthropic" | "openai";
  model: string;
  api_key_encrypted: string;
  analysis_model?: string | null;
}

/**
 * Modelo para el análisis.
 *
 * Puede ser distinto al del asistente que le contesta a los clientes: ése
 * conversa, éste clasifica de a cientos. Si no hay uno propio configurado, se
 * usa el mismo.
 */
function analysisModel(config: AiConfig): string {
  return process.env.ANALYSIS_MODEL?.trim() || config.analysis_model || config.model;
}

/**
 * Saca el JSON de la respuesta aunque venga envuelto.
 *
 * Los modelos a veces agregan un "Acá está el análisis:" o lo meten en un
 * bloque de código, y una conversación entera perdida por eso sería una
 * lástima. Se busca el primer objeto balanceado en vez de confiar en que la
 * respuesta sea JSON puro.
 */
function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  if (start === -1) throw new Error("la respuesta no trae JSON");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(raw.slice(start, i + 1));
    }
  }
  throw new Error("el JSON de la respuesta está incompleto");
}

function normalize(parsed: unknown): ReviewFindings {
  const o = (parsed ?? {}) as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 10) : [];

  const tono = o.tono as Record<string, unknown> | undefined;
  return {
    personal: o.personal === true,
    resumen: typeof o.resumen === "string" ? o.resumen.slice(0, 500) : "",
    sin_responder: arr(o.sin_responder),
    oportunidades: arr(o.oportunidades),
    tono: tono?.nivel
      ? { nivel: String(tono.nivel), nota: tono.nota ? String(tono.nota).slice(0, 300) : undefined }
      : null,
  };
}

export interface ReviewBatchResult {
  processed: number;
  requeued: number;
  personales: number;
  conHallazgos: number;
  errores: number;
}

/**
 * Analiza un lote de conversaciones pendientes.
 *
 * Mismo patrón que el enriquecedor: reclamo atómico, presupuesto de tiempo y
 * watchdog para lo que quede colgado. Si algo falla en una conversación, se
 * marca esa y el lote sigue — un error de la API no puede frenar la cola.
 */
export async function reviewBatch(
  db: SupabaseClient,
  opts: { limit?: number; deadline?: number } = {}
): Promise<ReviewBatchResult> {
  const limit = opts.limit ?? DEFAULT_BATCH;
  const deadline = opts.deadline ?? Date.now() + 240_000;

  const { data: requeued } = await db.rpc("requeue_stale_reviews");

  const { data: config } = await db
    .from("ai_config")
    .select("provider, model, api_key_encrypted, analysis_model")
    .eq("id", 1)
    .maybeSingle();

  if (!config?.api_key_encrypted) {
    // Sin clave no se puede analizar. No es un error del lote: es que falta
    // configurar el asistente.
    return { processed: 0, requeued: Number(requeued) || 0, personales: 0, conHallazgos: 0, errores: 0 };
  }

  const apiKey = decrypt(config.api_key_encrypted);
  const model = analysisModel(config as AiConfig);

  const { data: claimed, error } = await db.rpc("claim_conversation_reviews", { p_limit: limit });
  if (error) throw new Error(error.message);

  let personales = 0;
  let conHallazgos = 0;
  let errores = 0;
  let processed = 0;

  for (const review of (claimed ?? []) as Array<{ id: string; conversation_id: string }>) {
    if (Date.now() > deadline) {
      await db.from("conversation_reviews").update({ status: "pending" }).eq("id", review.id);
      continue;
    }

    try {
      const { data: transcript } = await db.rpc("conversation_transcript", {
        p_conversation_id: review.conversation_id,
        p_max_messages: TRANSCRIPT_LIMIT,
      });

      const lines = (transcript ?? []) as Array<{ quien: string; texto: string }>;
      if (lines.length === 0) {
        await db
          .from("conversation_reviews")
          .update({ status: "skipped", reviewed_at: new Date().toISOString() })
          .eq("id", review.id);
        processed++;
        continue;
      }

      const texto = lines.map((l) => `${l.quien}: ${l.texto}`).join("\n");
      const raw = await generateReply(
        config.provider as "anthropic" | "openai",
        apiKey,
        model,
        SYSTEM_PROMPT,
        [{ role: "user", content: texto }]
      );

      const f = normalize(extractJson(raw));
      if (f.personal) personales++;
      if (f.sin_responder.length > 0 || f.oportunidades.length > 0) conHallazgos++;

      await db
        .from("conversation_reviews")
        .update({
          status: "done",
          model,
          error: null,
          unanswered: f.sin_responder,
          missed: f.oportunidades,
          tone: f.tono,
          personal: f.personal,
          summary: f.resumen,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", review.id);
      processed++;
    } catch (err) {
      errores++;
      processed++;
      await db
        .from("conversation_reviews")
        .update({
          status: "failed",
          error: err instanceof Error ? err.message.slice(0, 500) : "error desconocido",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", review.id);
    }
  }

  return { processed, requeued: Number(requeued) || 0, personales, conHallazgos, errores };
}
