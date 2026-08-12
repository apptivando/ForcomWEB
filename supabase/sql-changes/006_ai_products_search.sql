-- ============================================================
-- 006 — El asistente de IA busca en el catálogo de productos (12/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor.
--
-- Hasta ahora el retrieval solo buscaba en ai_knowledge_chunks (FAQs
-- cargadas a mano) — nada sabía de los 18 productos reales. En vez de
-- duplicar esa info en documentos aparte (que se desactualizarían
-- cada vez que se edita un producto en /admin/productos), se indexa
-- `products` directo: una sola fuente de verdad.
--
-- Solo se indexan productos activos. No incluye precios (esa columna
-- no existe en `products` — nunca se mostró precio en la web
-- tampoco), así que no cambia la regla de "no inventar precios" del
-- system prompt.
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'public.spanish_unaccent',
      coalesce(model, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(full_specs, '') || ' ' ||
      coalesce(array_to_string(specs, ' '), '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS products_fts_idx ON products USING gin (fts);

CREATE OR REPLACE FUNCTION public.match_products_fts(
  p_query       text,
  p_match_count integer
)
RETURNS TABLE (id uuid, content text, rank real) AS $$
  SELECT p.id,
         'Producto: ' || p.model ||
           coalesce(' (' || p.category || ')', '') || E'\n' ||
           coalesce(p.description || E'\n', '') ||
           coalesce(array_to_string(p.specs, E'\n'), '') AS content,
         ts_rank(p.fts, q.query) AS rank
  FROM products p,
       (SELECT regexp_replace(
          plainto_tsquery('public.spanish_unaccent', p_query)::text,
          ' & ', ' | ', 'g'
        )::tsquery AS query) q
  WHERE p.active = true
    AND p.fts @@ q.query
  ORDER BY rank DESC
  LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.match_products_fts(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_products_fts(text, integer) TO authenticated, service_role;
