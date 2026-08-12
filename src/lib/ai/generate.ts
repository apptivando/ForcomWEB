export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Llama al proveedor configurado y devuelve el texto de la respuesta.
 * Fetch directo a la API REST de cada uno — sin SDK, mismo criterio
 * que src/lib/evolution.ts (adaptadores livianos, sin dependencias
 * nuevas).
 */
export async function generateReply(
  provider: "anthropic" | "openai",
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatMessage[]
): Promise<string> {
  if (provider === "anthropic") return generateAnthropic(apiKey, model, systemPrompt, history);
  return generateOpenAi(apiKey, model, systemPrompt, history);
}

async function generateAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatMessage[]
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: history,
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic API → ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") throw new Error("Respuesta de Anthropic sin texto");
  return text;
}

async function generateOpenAi(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatMessage[]
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...history],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI API → ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("Respuesta de OpenAI sin texto");
  return text;
}
