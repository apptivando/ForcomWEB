import type { SupabaseClient } from "@supabase/supabase-js";
import { sendText } from "@/lib/evolution";

interface AutomationRow {
  id: string;
  name: string;
  trigger_type: "keyword_match" | "new_conversation";
  trigger_keywords: string[] | null;
  active: boolean;
}

interface StepRow {
  id: string;
  automation_id: string;
  step_index: number;
  action_type: "send_message" | "wait" | "assign_agent";
  message_text: string | null;
  wait_minutes: number | null;
  assign_member_id: string | null;
}

async function log(
  db: SupabaseClient,
  automationId: string,
  conversationId: string,
  stepIndex: number | null,
  actionType: string | null,
  status: "success" | "error",
  detail?: string
) {
  await db.from("automation_logs").insert({
    automation_id: automationId,
    conversation_id: conversationId,
    step_index: stepIndex,
    action_type: actionType,
    status,
    detail: detail ?? null,
  });
}

/**
 * Busca automatizaciones activas cuyo disparador matchea. `keyword_match`
 * es case-insensitive y busca la palabra en cualquier parte del mensaje
 * (simple, como el filtro de wacrm — no es full-text search).
 */
export async function matchAutomations(
  db: SupabaseClient,
  messageText: string,
  isNewConversation: boolean
): Promise<AutomationRow[]> {
  const { data, error } = await db.from("automations").select("*").eq("active", true);
  if (error || !data) return [];

  const lowerMessage = messageText.toLowerCase();
  return (data as AutomationRow[]).filter((a) => {
    if (a.trigger_type === "new_conversation") return isNewConversation;
    if (a.trigger_type === "keyword_match") {
      return (a.trigger_keywords ?? []).some((kw) => lowerMessage.includes(kw.toLowerCase()));
    }
    return false;
  });
}

/**
 * Corre los pasos de una automatización desde `startIndex` en
 * adelante. Se detiene en el primer `wait` (agenda la continuación en
 * automation_pending_executions, para que el cron la retome) o al
 * llegar al final. Cada paso queda logueado.
 */
export async function runFromStep(
  db: SupabaseClient,
  automation: Pick<AutomationRow, "id" | "name">,
  conversationId: string,
  phone: string,
  startIndex: number
): Promise<void> {
  const { data: steps } = await db
    .from("automation_steps")
    .select("*")
    .eq("automation_id", automation.id)
    .gte("step_index", startIndex)
    .order("step_index");

  if (!steps?.length) return;

  for (const step of steps as StepRow[]) {
    try {
      if (step.action_type === "wait") {
        const minutes = step.wait_minutes ?? 60;
        await db.from("automation_pending_executions").insert({
          automation_id: automation.id,
          conversation_id: conversationId,
          next_step_index: step.step_index + 1,
          run_at: new Date(Date.now() + minutes * 60_000).toISOString(),
        });
        await log(db, automation.id, conversationId, step.step_index, "wait", "success", `${minutes} min`);
        return; // el cron sigue desde acá — no seguir ejecutando ahora
      }

      if (step.action_type === "send_message" && step.message_text) {
        const result = await sendText(phone, step.message_text);
        await db.from("crm_messages").insert({
          conversation_id: conversationId,
          direction: "out",
          content_type: "text",
          content_text: step.message_text,
          wa_message_id: result?.key?.id ?? null,
        });
        await db
          .from("crm_conversations")
          .update({ last_message_text: step.message_text, last_message_at: new Date().toISOString() })
          .eq("id", conversationId);
        await log(db, automation.id, conversationId, step.step_index, "send_message", "success");
      }

      if (step.action_type === "assign_agent" && step.assign_member_id) {
        await db
          .from("crm_conversations")
          .update({ assigned_member_id: step.assign_member_id })
          .eq("id", conversationId);
        await log(db, automation.id, conversationId, step.step_index, "assign_agent", "success");
      }
    } catch (err) {
      await log(
        db,
        automation.id,
        conversationId,
        step.step_index,
        step.action_type,
        "error",
        err instanceof Error ? err.message : String(err)
      );
      return; // no seguir con los pasos siguientes si uno falla
    }
  }
}

/**
 * Se llama desde el webhook de Evolution tras guardar un mensaje
 * entrante. Devuelve `true` si alguna automatización mandó al menos un
 * mensaje — en ese caso el auto-reply de IA no debe contestar encima
 * (misma prioridad que wacrm: automatizaciones primero, IA como
 * respaldo si nada más contestó).
 */
export async function dispatchAutomations(
  db: SupabaseClient,
  conversationId: string,
  phone: string,
  messageText: string,
  isNewConversation: boolean
): Promise<boolean> {
  const matched = await matchAutomations(db, messageText, isNewConversation);
  if (matched.length === 0) return false;

  let sentSomething = false;
  for (const automation of matched) {
    const { data: firstStep } = await db
      .from("automation_steps")
      .select("action_type")
      .eq("automation_id", automation.id)
      .eq("step_index", 0)
      .maybeSingle();
    if (firstStep?.action_type === "send_message") sentSomething = true;

    await runFromStep(db, automation, conversationId, phone, 0);
  }
  return sentSomething;
}

/**
 * Cron (cada 5 min, ver vercel.json + api/cron/automations). Retoma
 * las automatizaciones que quedaron esperando.
 */
export async function processPendingExecutions(db: SupabaseClient): Promise<number> {
  const { data: due } = await db
    .from("automation_pending_executions")
    .select("*, automation:automations(id, name), conversation:crm_conversations(id, contact:crm_contacts(phone))")
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString());

  if (!due?.length) return 0;

  for (const pending of due) {
    await db.from("automation_pending_executions").update({ status: "done" }).eq("id", pending.id);
    const phone = pending.conversation?.contact?.phone;
    if (!phone || !pending.automation) continue;
    await runFromStep(db, pending.automation, pending.conversation_id, phone, pending.next_step_index);
  }

  return due.length;
}
