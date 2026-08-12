-- ============================================================
-- 005 — Búsqueda de la base de conocimiento: Y → O lógico (12/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor.
--
-- match_ai_knowledge_fts usaba plainto_tsquery tal cual, que arma un
-- AND entre todas las palabras de la pregunta. Una pregunta en
-- lenguaje natural ("¿cuál es la garantía de los productos?") tiene
-- palabras de relleno que no están en ningún documento ("cuál",
-- "productos") — alcanza con que UNA no matchee para que la búsqueda
-- entera devuelva cero resultados, aunque "garantía" sí esté.
-- Confirmado en vivo: "garantia" sola encontraba el documento, la
-- pregunta completa no.
--
-- Fix: convertir los & (Y) del tsquery en | (O) — mismos términos
-- (ya normalizados por spanish_unaccent), pero ahora alcanza con que
-- matchee alguno; ts_rank sigue priorizando los chunks con más
-- coincidencias, así que la relevancia no se pierde.
-- ============================================================

CREATE OR REPLACE FUNCTION public.match_ai_knowledge_fts(
  p_query       text,
  p_match_count integer
)
RETURNS TABLE (id uuid, content text, rank real) AS $$
  SELECT c.id,
         c.content,
         ts_rank(c.fts, q.query) AS rank
  FROM ai_knowledge_chunks c,
       (SELECT regexp_replace(
          plainto_tsquery('public.spanish_unaccent', p_query)::text,
          ' & ', ' | ', 'g'
        )::tsquery AS query) q
  WHERE c.fts @@ q.query
  ORDER BY rank DESC
  LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
