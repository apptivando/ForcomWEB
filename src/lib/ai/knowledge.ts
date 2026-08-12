import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkText } from "./chunk";

interface MatchRow {
  id: string;
  content: string;
  rank: number;
}

/**
 * (Re)genera los chunks de un documento. Reemplaza los existentes —
 * el re-ingest tiene que ser idempotente.
 */
export async function ingestDocument(
  db: SupabaseClient,
  documentId: string,
  content: string
): Promise<void> {
  const chunks = chunkText(content);

  const { error: delErr } = await db
    .from("ai_knowledge_chunks")
    .delete()
    .eq("document_id", documentId);
  if (delErr) throw delErr;

  if (chunks.length === 0) return;

  const rows = chunks.map((c, i) => ({ document_id: documentId, chunk_index: i, content: c }));
  const { error: insErr } = await db.from("ai_knowledge_chunks").insert(rows);
  if (insErr) throw insErr;
}

/**
 * Trae hasta `k` fragmentos relevantes a `queryText`, combinando la
 * base de conocimiento cargada a mano (FAQs) y el catálogo de
 * productos real — una sola fuente de verdad para productos, no se
 * duplica contenido en documentos aparte que se desactualizarían.
 * Best-effort: cualquier falla degrada a `[]` en vez de tirar (no debe
 * romper el auto-reply).
 */
export async function retrieveKnowledge(
  db: SupabaseClient,
  queryText: string,
  k = 5
): Promise<string[]> {
  const query = queryText.trim();
  if (!query || k <= 0) return [];

  const [faqResult, productsResult] = await Promise.allSettled([
    db.rpc("match_ai_knowledge_fts", { p_query: query, p_match_count: k }),
    db.rpc("match_products_fts", { p_query: query, p_match_count: k }),
  ]);

  const rows: MatchRow[] = [];
  if (faqResult.status === "fulfilled" && Array.isArray(faqResult.value.data)) {
    rows.push(...(faqResult.value.data as MatchRow[]));
  }
  if (productsResult.status === "fulfilled" && Array.isArray(productsResult.value.data)) {
    rows.push(...(productsResult.value.data as MatchRow[]));
  }

  return rows
    .sort((a, b) => b.rank - a.rank)
    .slice(0, k)
    .map((r) => r.content);
}
