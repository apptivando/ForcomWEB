-- ============================================================
-- 004 — Asistente de IA + base de conocimiento (12/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor.
--
-- Fase 4 del Track E. Diseño calcado del de wacrm (ai_configs +
-- ai_knowledge_documents/chunks, c:\Apptivando\wacrm) pero adaptado a
-- un solo negocio: ai_config es una fila única (id=1), como
-- company_info/hero_content — no hace falta una fila por cuenta.
--
-- Búsqueda léxica en español desde el día uno (no 'simple' como el
-- wacrm original) — misma config `spanish_unaccent` que se armó para
-- wacrm el 31/07/2026, recreada acá.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_ts_config WHERE cfgname = 'spanish_unaccent'
  ) THEN
    CREATE TEXT SEARCH CONFIGURATION public.spanish_unaccent (COPY = pg_catalog.spanish);
  END IF;
END $$;

ALTER TEXT SEARCH CONFIGURATION public.spanish_unaccent
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;

-- Fila única — mismo patrón que hero_content/company_info.
CREATE TABLE IF NOT EXISTS ai_config (
  id                          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider                    TEXT NOT NULL DEFAULT 'anthropic' CHECK (provider IN ('anthropic', 'openai')),
  model                       TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  api_key_encrypted           TEXT,
  system_prompt               TEXT NOT NULL DEFAULT '',
  auto_reply_enabled          BOOLEAN NOT NULL DEFAULT false,
  max_replies_per_conversation INTEGER NOT NULL DEFAULT 3,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ai_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can manage ai_config" ON ai_config;
CREATE POLICY "Members can manage ai_config" ON ai_config FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

CREATE TABLE IF NOT EXISTS ai_knowledge_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_by  UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_knowledge_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can manage ai_knowledge_documents" ON ai_knowledge_documents;
CREATE POLICY "Members can manage ai_knowledge_documents" ON ai_knowledge_documents FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES ai_knowledge_documents(id) ON DELETE CASCADE,
  chunk_index  INTEGER NOT NULL DEFAULT 0,
  content      TEXT NOT NULL,
  fts          tsvector GENERATED ALWAYS AS (to_tsvector('public.spanish_unaccent', content)) STORED,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_document_id_idx ON ai_knowledge_chunks (document_id);
CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_fts_idx ON ai_knowledge_chunks USING gin (fts);

ALTER TABLE ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can manage ai_knowledge_chunks" ON ai_knowledge_chunks;
CREATE POLICY "Members can manage ai_knowledge_chunks" ON ai_knowledge_chunks FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

-- RPC de retrieval — misma forma que match_ai_knowledge_fts de wacrm,
-- sin p_account_id (un solo negocio). SECURITY DEFINER porque el
-- auto-reply corre con la service role, sin sesión de usuario.
CREATE OR REPLACE FUNCTION public.match_ai_knowledge_fts(
  p_query       text,
  p_match_count integer
)
RETURNS TABLE (id uuid, content text, rank real) AS $$
  SELECT c.id,
         c.content,
         ts_rank(c.fts, plainto_tsquery('public.spanish_unaccent', p_query)) AS rank
  FROM ai_knowledge_chunks c
  WHERE c.fts @@ plainto_tsquery('public.spanish_unaccent', p_query)
  ORDER BY rank DESC
  LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.match_ai_knowledge_fts(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_fts(text, integer) TO authenticated, service_role;

-- ai_reply_count por conversación — cuántas veces contestó la IA en
-- esta conversación puntual, para respetar max_replies_per_conversation.
ALTER TABLE crm_conversations ADD COLUMN IF NOT EXISTS ai_reply_count INTEGER NOT NULL DEFAULT 0;
