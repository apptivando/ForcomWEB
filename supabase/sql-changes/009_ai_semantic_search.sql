-- ============================================================
-- 009 — Búsqueda semántica para el asistente (13/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor.
--
-- Probado en vivo: "a qué hora atienden" no encontraba el documento
-- que dice "Horario de atención" — la búsqueda léxica (por más que
-- corrija acentos/plurales) no relaciona palabras distintas que
-- significan lo mismo ("hora" ≠ "horario", "atienden" ≠ "atención").
-- Mismo diseño que wacrm: clave de embeddings opcional (OpenAI,
-- separada de la clave del modelo de chat — Anthropic no tiene API de
-- embeddings), semántica primero, léxica de respaldo si no alcanza.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS embeddings_api_key_encrypted TEXT;

ALTER TABLE ai_knowledge_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- HNSW: la base empieza vacía y crece de a poco, no hace falta
-- IVFFlat (que necesita un tamaño mínimo de datos para entrenar bien).
CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_embedding_idx
  ON ai_knowledge_chunks USING hnsw (embedding vector_cosine_ops);

-- p_query_embedding es texto (no vector) — el caller manda el literal
-- "[0.1,0.2,...]" como string plano, sin ambigüedad de cómo PostgREST
-- lo bindea, y se castea acá adentro.
CREATE OR REPLACE FUNCTION public.match_ai_knowledge_semantic(
  p_query_embedding text,
  p_match_count     integer
)
RETURNS TABLE (id uuid, content text, distance real) AS $$
  SELECT c.id,
         c.content,
         (c.embedding <=> p_query_embedding::vector) AS distance
  FROM ai_knowledge_chunks c
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding <=> p_query_embedding::vector
  LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.match_ai_knowledge_semantic(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_semantic(text, integer) TO authenticated, service_role;
