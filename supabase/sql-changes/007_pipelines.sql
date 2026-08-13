-- ============================================================
-- 007 — Pipelines de venta (12/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor.
--
-- Fase 5 del Track E. Kanban simple: etapas fijas (editables después
-- si hace falta) + tarjetas vinculadas a un contacto de crm_contacts.
-- Sin drag-and-drop por ahora — mover de etapa es un selector en la
-- tarjeta (no hay librería de UI en este proyecto, y un drag-and-drop
-- a mano es mucho más código para el mismo resultado funcional).
-- ============================================================

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pipeline_stages (name, order_index)
SELECT * FROM (VALUES
  ('Nuevo', 0),
  ('Contactado', 1),
  ('Cotizado', 2),
  ('Negociación', 3),
  ('Ganado', 4),
  ('Perdido', 5)
) AS defaults(name, order_index)
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages);

CREATE TABLE IF NOT EXISTS pipeline_deals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id          UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  stage_id            UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  title               TEXT NOT NULL,
  value               NUMERIC,
  notes               TEXT,
  assigned_member_id  UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pipeline_deals_stage_id_idx ON pipeline_deals (stage_id);
CREATE INDEX IF NOT EXISTS pipeline_deals_contact_id_idx ON pipeline_deals (contact_id);

CREATE OR REPLACE FUNCTION public.touch_pipeline_deal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pipeline_deals_updated_at ON pipeline_deals;
CREATE TRIGGER pipeline_deals_updated_at
  BEFORE UPDATE ON pipeline_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_pipeline_deal_updated_at();

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage pipeline_stages" ON pipeline_stages;
CREATE POLICY "Members can manage pipeline_stages" ON pipeline_stages FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

DROP POLICY IF EXISTS "Members can manage pipeline_deals" ON pipeline_deals;
CREATE POLICY "Members can manage pipeline_deals" ON pipeline_deals FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);
