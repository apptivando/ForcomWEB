// Embeddings vía OpenAI (Anthropic no tiene API de embeddings) —
// clave separada de la del modelo de chat, opcional. Mismo criterio
// que wacrm: bring-your-own-key, sin variable de entorno global.

const MODEL = "text-embedding-3-small"; // 1536 dims, coincide con ai_knowledge_chunks.embedding

export async function embedTexts(apiKey: string, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI embeddings → ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return (data.data as { embedding: number[] }[]).map((d) => d.embedding);
}

/** pgvector espera el literal "[0.1,0.2,...]" como texto plano. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
