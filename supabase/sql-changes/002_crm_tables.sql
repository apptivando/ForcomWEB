-- ============================================================
-- 002 — CRM propio: contactos, conversaciones, mensajes (01/08/2026)
-- FALTA CORRER. Ejecutar en Supabase Dashboard > SQL Editor.
--
-- Fase 2 del Track E — reemplaza a wacrm. Conectado a WhatsApp vía
-- Evolution API (self-hosted), no directo a Meta. Prefijo `crm_` para
-- no confundir con `contact_messages` (el buzón viejo del formulario
-- de contacto, que sigue existiendo aparte como log de auditoría).
--
-- Un solo negocio (FORCOM), sin multi-cuenta — a diferencia de wacrm,
-- no hace falta `account_id` en ningún lado. `assigned_member_id` /
-- `sender_member_id` referencian a `admin_members` (001), no a una
-- tabla de cuentas.
--
-- Requiere haber corrido 001_admin_roles_members.sql antes (usa
-- admin_members y current_admin_role()).
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL UNIQUE,  -- E.164 con 9, ej. 5493511234567 (ver normalizeArgentinePhone en api/contact/route.ts)
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_conversations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id             UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  status                 TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  last_message_text      TEXT,
  last_message_at        TIMESTAMPTZ,
  ai_autoreply_disabled  BOOLEAN NOT NULL DEFAULT false,
  assigned_member_id     UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_conversations_contact_id_idx ON crm_conversations (contact_id);

CREATE TABLE IF NOT EXISTS crm_messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    UUID NOT NULL REFERENCES crm_conversations(id) ON DELETE CASCADE,
  direction          TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  content_type       TEXT NOT NULL DEFAULT 'text',
  content_text       TEXT,
  media_url          TEXT,
  wa_message_id      TEXT UNIQUE,  -- idempotencia: Evolution puede reintentar el webhook
  ai_generated       BOOLEAN NOT NULL DEFAULT false,
  sender_member_id   UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,  -- null si es del cliente o de la IA
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_messages_conversation_id_idx ON crm_messages (conversation_id);

CREATE OR REPLACE FUNCTION public.touch_crm_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS crm_conversations_updated_at ON crm_conversations;
CREATE TRIGGER crm_conversations_updated_at
  BEFORE UPDATE ON crm_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_crm_conversation_updated_at();

ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_messages ENABLE ROW LEVEL SECURITY;

-- Cualquier miembro del admin (cualquier rol) puede leer y operar el
-- CRM — a diferencia de admin_members, donde solo admin/owner
-- gestionan gente. El webhook y el envío de mensajes corren con la
-- service role (bypasea RLS), así que estas políticas son para la UI.
DROP POLICY IF EXISTS "Members can manage crm_contacts" ON crm_contacts;
CREATE POLICY "Members can manage crm_contacts" ON crm_contacts FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

DROP POLICY IF EXISTS "Members can manage crm_conversations" ON crm_conversations;
CREATE POLICY "Members can manage crm_conversations" ON crm_conversations FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

DROP POLICY IF EXISTS "Members can manage crm_messages" ON crm_messages;
CREATE POLICY "Members can manage crm_messages" ON crm_messages FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);
