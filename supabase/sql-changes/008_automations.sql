-- ============================================================
-- 008 — Automatizaciones (12/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor.
--
-- Fase 6 del Track E. Pedido explícito: "lo más parecido a lo que
-- tenía wacrm" — no una acción suelta por disparador, sino pasos en
-- secuencia (mandar mensaje → esperar → mandar otro → asignar a un
-- humano, etc.), igual que automations/automation_steps/
-- automation_pending_executions/automation_logs de wacrm.
--
-- Las esperas (`wait`) se resuelven con un Cron Job de Vercel
-- (vercel.json, cada 5 min) que revisa automation_pending_executions
-- y sigue la secuencia donde quedó — ver
-- src/app/api/cron/automations/route.ts.
-- ============================================================

CREATE TABLE IF NOT EXISTS automations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  trigger_type      TEXT NOT NULL CHECK (trigger_type IN ('keyword_match', 'new_conversation')),
  trigger_keywords  TEXT[],
  active            BOOLEAN NOT NULL DEFAULT true,
  created_by        UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_steps (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id      UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  step_index         INTEGER NOT NULL,
  action_type        TEXT NOT NULL CHECK (action_type IN ('send_message', 'wait', 'assign_agent')),
  message_text       TEXT,       -- action_type = send_message
  wait_minutes       INTEGER,    -- action_type = wait
  assign_member_id   UUID REFERENCES admin_members(user_id) ON DELETE SET NULL, -- action_type = assign_agent
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (automation_id, step_index)
);

CREATE TABLE IF NOT EXISTS automation_pending_executions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id     UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  conversation_id   UUID NOT NULL REFERENCES crm_conversations(id) ON DELETE CASCADE,
  next_step_index   INTEGER NOT NULL,
  run_at            TIMESTAMPTZ NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_pending_executions_due_idx
  ON automation_pending_executions (status, run_at);

CREATE TABLE IF NOT EXISTS automation_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id     UUID REFERENCES automations(id) ON DELETE SET NULL,
  conversation_id   UUID REFERENCES crm_conversations(id) ON DELETE SET NULL,
  step_index        INTEGER,
  action_type       TEXT,
  status            TEXT NOT NULL CHECK (status IN ('success', 'error')),
  detail            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_logs_automation_id_idx ON automation_logs (automation_id);

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_pending_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage automations" ON automations;
CREATE POLICY "Members can manage automations" ON automations FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

DROP POLICY IF EXISTS "Members can manage automation_steps" ON automation_steps;
CREATE POLICY "Members can manage automation_steps" ON automation_steps FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

DROP POLICY IF EXISTS "Members can read automation_pending_executions" ON automation_pending_executions;
CREATE POLICY "Members can read automation_pending_executions" ON automation_pending_executions FOR SELECT
  USING (public.current_admin_role() IS NOT NULL);

DROP POLICY IF EXISTS "Members can read automation_logs" ON automation_logs;
CREATE POLICY "Members can read automation_logs" ON automation_logs FOR SELECT
  USING (public.current_admin_role() IS NOT NULL);
