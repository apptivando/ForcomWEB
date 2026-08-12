import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkText } from "./chunk";

interface MatchRow {
  id: string;
  content: string;
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
 * Trae hasta `k` fragmentos relevantes a `queryText` vía búsqueda de
 * texto completo en español. Best-effort: cualquier falla degrada a
 * `[]` en vez de tirar (no debe romper el auto-reply).
 */
export async function retrieveKnowledge(
  db: SupabaseClient,
  queryText: string,
  k = 5
): Promise<string[]> {
  const query = queryText.trim();
  if (!query || k <= 0) return [];

  try {
    const { data, error } = await db.rpc("match_ai_knowledge_fts", {
      p_query: query,
      p_match_count: k,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as MatchRow[]).map((r) => r.content);
  } catch {
    return [];
  }
}
