-- ============================================================
-- 003 — Respuestas rápidas (12/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor.
--
-- Fase 3 del Track E (cierre) — mensajes cortos reutilizables desde el
-- composer de la bandeja. Compartidas entre todo el equipo (no hace
-- falta separar por usuario, es un solo negocio).
-- ============================================================

CREATE TABLE IF NOT EXISTS quick_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_by  UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage quick_replies" ON quick_replies;
CREATE POLICY "Members can manage quick_replies" ON quick_replies FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);
