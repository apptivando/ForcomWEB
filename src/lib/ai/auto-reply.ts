import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption";
import { retrieveKnowledge, getCatalogIndex } from "./knowledge";
import { generateReply, type ChatMessage } from "./generate";
import { sendText } from "@/lib/evolution";

interface AiConfigRow {
  provider: "anthropic" | "openai";
  model: string;
  api_key_encrypted: string;
  system_prompt: string;
}

const DISAMBIGUATION_RULE =
  "Si la pregunta es genérica y en el mapa del catálogo hay más de un " +
  "producto de la misma sección que podría aplicar (ej. \"impresora " +
  "térmica\" cuando la sección tiene varios modelos), NO recomiendes uno " +
  "al azar — primero preguntá qué necesita el cliente para acotar " +
  "(uso, volumen, tickets vs. etiquetas, etc.), y recién ahí sugerí el " +
  "modelo puntual. Si la pregunta ya es específica (nombra un modelo o " +
  "un uso claro), respondé directo.";

/**
 * Arma el prompt (instrucciones + mapa del catálogo + info de
 * referencia relevante + regla de desambiguación) y llama al modelo.
 * Compartido entre el auto-reply real y el modo de prueba de
 * /admin/agente — misma lógica exacta, para que probar ahí sea
 * confiable (no una simulación aparte que podría comportarse distinto).
 */
export async function generateAssistantReply(
  db: SupabaseClient,
  config: AiConfigRow,
  history: ChatMessage[]
): Promise<string> {
  const lastUserMessage = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const [knowledge, catalogIndex] = await Promise.all([
    retrieveKnowledge(db, lastUserMessage),
    getCatalogIndex(db),
  ]);

  const systemPrompt = [
    config.system_prompt,
    catalogIndex && `Mapa del catálogo (todo lo que existe, por sección — para el detalle completo de un modelo puntual usá la información de referencia si está más abajo):\n${catalogIndex}`,
    knowledge.length && `Información de referencia:\n${knowledge.join("\n\n---\n\n")}`,
    DISAMBIGUATION_RULE,
  ]
    .filter(Boolean)
    .join("\n\n");

  const apiKey = decrypt(config.api_key_encrypted);
  return generateReply(config.provider, apiKey, config.model, systemPrompt, history);
}

/**
 * Dispara la respuesta automática para un mensaje entrante recién
 * guardado. Se llama desde el webhook de Evolution, después de
 * insertar el mensaje inbound. Falla en silencio (solo loguea) — un
 * problema acá nunca debe hacer fallar el webhook en sí.
 */
export async function dispatchAutoReply(conversationId: string, phone: string): Promise<void> {
  const db = createAdminClient();

  try {
    const { data: config } = await db.from("ai_config").select("*").eq("id", 1).single();
    if (!config?.auto_reply_enabled || !config.api_key_encrypted) return;

    const { data: conv } = await db
      .from("crm_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();
    if (!conv) return;
    if (conv.assigned_member_id) return; // un humano ya está en la conversación
    if (conv.ai_autoreply_disabled) return;
    if (conv.ai_reply_count >= config.max_replies_per_conversation) return;

    const { data: recentMessages } = await db
      .from("crm_messages")
      .select("direction, content_text")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    const history: ChatMessage[] = (recentMessages ?? [])
      .reverse()
      .filter((m) => m.content_text)
      .map((m) => ({
        role: m.direction === "out" ? "assistant" : "user",
        content: m.content_text as string,
      }));

    const replyText = await generateAssistantReply(db, config, history);
    if (!replyText?.trim()) return;

    const result = await sendText(phone, replyText);

    await db.from("crm_messages").insert({
      conversation_id: conversationId,
      direction: "out",
      content_type: "text",
      content_text: replyText,
      wa_message_id: result?.key?.id ?? null,
      ai_generated: true,
    });

    await db
      .from("crm_conversations")
      .update({
        last_message_text: replyText,
        last_message_at: new Date().toISOString(),
        ai_reply_count: conv.ai_reply_count + 1,
      })
      .eq("id", conversationId);
  } catch (err) {
    console.error("[ai auto-reply] falló:", err instanceof Error ? err.message : err);
  }
}
