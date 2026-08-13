import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkText } from "./chunk";
import { embedTexts, toVectorLiteral } from "./embeddings";

interface MatchRow {
  id: string;
  content: string;
  rank: number;
}

interface SemanticMatchRow {
  id: string;
  content: string;
  distance: number;
}

/**
 * (Re)genera los chunks de un documento. Reemplaza los existentes —
 * el re-ingest tiene que ser idempotente. Si hay clave de embeddings
 * configurada, calcula el embedding de cada chunk — best-effort: si
 * falla (clave inválida, OpenAI caído), los chunks igual quedan
 * guardados y buscables por texto, solo sin el embedding.
 */
export async function ingestDocument(
  db: SupabaseClient,
  documentId: string,
  content: string,
  embeddingsApiKey?: string | null
): Promise<void> {
  const chunks = chunkText(content);

  const { error: delErr } = await db
    .from("ai_knowledge_chunks")
    .delete()
    .eq("document_id", documentId);
  if (delErr) throw delErr;

  if (chunks.length === 0) return;

  let embeddings: number[][] | null = null;
  if (embeddingsApiKey) {
    try {
      embeddings = await embedTexts(embeddingsApiKey, chunks);
    } catch (err) {
      console.error("[ai knowledge] embeddings falló, queda solo búsqueda por texto:", err);
    }
  }

  const rows = chunks.map((c, i) => ({
    document_id: documentId,
    chunk_index: i,
    content: c,
    embedding: embeddings ? toVectorLiteral(embeddings[i]) : null,
  }));
  const { error: insErr } = await db.from("ai_knowledge_chunks").insert(rows);
  if (insErr) throw insErr;
}

/**
 * Recalcula el embedding de TODOS los chunks existentes — para cuando
 * se agrega/cambia la clave de embeddings después de haber cargado
 * documentos sin ella.
 */
export async function reindexAllEmbeddings(db: SupabaseClient, embeddingsApiKey: string): Promise<number> {
  const { data: chunks, error } = await db.from("ai_knowledge_chunks").select("id, content");
  if (error || !chunks?.length) return 0;

  const embeddings = await embedTexts(embeddingsApiKey, chunks.map((c) => c.content));
  await Promise.all(
    chunks.map((c, i) =>
      db.from("ai_knowledge_chunks").update({ embedding: toVectorLiteral(embeddings[i]) }).eq("id", c.id)
    )
  );
  return chunks.length;
}

/**
 * Trae hasta `k` fragmentos relevantes a `queryText`. Semántica
 * primero (si hay clave de embeddings) — encuentra por significado,
 * no solo por palabra exacta (ej. "a qué hora atienden" ⇄ "horario de
 * atención", que la búsqueda léxica no relaciona). Se completa con
 * léxico (FAQs + catálogo de productos real) hasta llegar a `k`.
 * Best-effort: cualquier falla degrada en vez de tirar (no debe romper
 * el auto-reply).
 */
export async function retrieveKnowledge(
  db: SupabaseClient,
  queryText: string,
  embeddingsApiKey?: string | null,
  k = 5
): Promise<string[]> {
  const query = queryText.trim();
  if (!query || k <= 0) return [];

  const picked = new Map<string, string>(); // id → content, conserva el orden de inserción (prioridad)

  if (embeddingsApiKey) {
    try {
      const [queryEmbedding] = await embedTexts(embeddingsApiKey, [query]);
      const { data, error } = await db.rpc("match_ai_knowledge_semantic", {
        p_query_embedding: toVectorLiteral(queryEmbedding),
        p_match_count: k,
      });
      if (!error && Array.isArray(data)) {
        for (const row of data as SemanticMatchRow[]) picked.set(row.id, row.content);
      }
    } catch (err) {
      console.error("[ai knowledge] búsqueda semántica falló, sigue con léxica:", err);
    }
  }

  if (picked.size < k) {
    const [faqResult, productsResult] = await Promise.allSettled([
      db.rpc("match_ai_knowledge_fts", { p_query: query, p_match_count: k }),
      db.rpc("match_products_fts", { p_query: query, p_match_count: k }),
    ]);

    const lexicalRows: MatchRow[] = [];
    if (faqResult.status === "fulfilled" && Array.isArray(faqResult.value.data)) {
      lexicalRows.push(...(faqResult.value.data as MatchRow[]));
    }
    if (productsResult.status === "fulfilled" && Array.isArray(productsResult.value.data)) {
      lexicalRows.push(...(productsResult.value.data as MatchRow[]));
    }
    for (const row of lexicalRows.sort((a, b) => b.rank - a.rank)) {
      if (picked.size >= k) break;
      if (!picked.has(row.id)) picked.set(row.id, row.content);
    }
  }

  return Array.from(picked.values()).slice(0, k);
}

/**
 * Mapa corto de todo el catálogo activo, agrupado por sección —
 * SIEMPRE va en el prompt (no depende de la búsqueda). Sin esto, una
 * pregunta genérica ("¿tenés impresora térmica?") sólo trae 2-3
 * descripciones larguísimas de productos por separado, y el modelo no
 * tiene forma de darse cuenta de que hay varias opciones distintas
 * dentro de la misma sección (tickets vs. etiquetas, por ejemplo) —
 * así que termina recomendando una al azar en vez de preguntar.
 * Con el mapa completo a la vista, el modelo puede notar la
 * ambigüedad y pedir que el cliente precise antes de responder.
 */
export async function getCatalogIndex(db: SupabaseClient): Promise<string> {
  const { data, error } = await db
    .from("products")
    .select("model, category, section")
    .eq("active", true)
    .order("section")
    .order("category");
  if (error || !data?.length) return "";

  const bySection = new Map<string, string[]>();
  for (const p of data as { model: string; category: string; section: string }[]) {
    const list = bySection.get(p.section) ?? [];
    list.push(`${p.model} (${p.category})`);
    bySection.set(p.section, list);
  }

  return Array.from(bySection.entries())
    .map(([section, models]) => `${section}: ${models.join(", ")}`)
    .join("\n");
}
