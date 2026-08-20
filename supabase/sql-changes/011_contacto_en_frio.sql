-- ============================================================
-- 011 — Contacto en frío: plantillas, tope diario y trazabilidad (20/08/2026)
-- FALTA CORRER. Ejecutar en Supabase Dashboard > SQL Editor, entero.
--
-- Permite escribirle desde la plataforma a un prospecto que nunca nos
-- contactó, de dos formas: abriendo la conversación en la Bandeja para
-- que una persona escriba, o mandando una plantilla.
--
-- POR QUÉ HAY PLANTILLAS Y NO SOLO TEXTO LIBRE
-- El destino es una conexión oficial con Meta (WhatsApp Cloud API). Ahí
-- rige la "ventana de atención de 24 horas": se puede escribir texto
-- libre SOLO dentro de las 24 h posteriores al último mensaje DEL
-- CLIENTE. Fuera de esa ventana —o sea, en todo contacto en frío— lo
-- único que Meta acepta es una plantilla previamente aprobada por ellos.
-- Por eso las plantillas se modelan desde ahora con los campos que Meta
-- pide (nombre, idioma, categoría, estado de aprobación): cuando se
-- migre de Evolution a Meta no hay que rehacer nada.
--
-- Requiere 001, 002 y 010.
-- ============================================================


-- ============================================================
-- 1. Plantillas de contacto inicial
-- ============================================================
-- Separadas de `quick_replies` a propósito, aunque se parezcan: una
-- respuesta rápida es texto que un agente inserta DENTRO de una
-- conversación abierta (no necesita aprobación de nadie), y una
-- plantilla es un mensaje que INICIA la conversación y que Meta tiene
-- que aprobar antes. Distinto ciclo de vida, distintos permisos,
-- distinta tabla.
CREATE TABLE IF NOT EXISTS outreach_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  -- Nombre exacto de la plantilla en Meta (minúsculas y guiones bajos).
  -- Nulo mientras se trabaja con Evolution.
  meta_template_name  TEXT,
  language            TEXT NOT NULL DEFAULT 'es_AR',
  -- Categorías de Meta. 'marketing' es la que aplica a prospección en
  -- frío; 'utility' es para avisos de algo que el cliente ya pidió.
  category            TEXT NOT NULL DEFAULT 'marketing'
                      CHECK (category IN ('marketing', 'utility', 'authentication')),
  -- borrador → se está escribiendo · enviada → esperando a Meta
  -- aprobada → se puede usar · rechazada → Meta la bajó
  status              TEXT NOT NULL DEFAULT 'borrador'
                      CHECK (status IN ('borrador', 'enviada', 'aprobada', 'rechazada')),
  rejection_reason    TEXT,
  -- El cuerpo usa marcadores {{1}}, {{2}}… igual que Meta.
  body                TEXT NOT NULL,
  -- Qué representa cada marcador, en orden. Ej: ["razón social", "rubro"].
  -- Sirve para completarlos solos desde la ficha del cliente.
  variables           JSONB NOT NULL DEFAULT '[]'::jsonb,
  active              BOOLEAN NOT NULL DEFAULT true,
  created_by          UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS outreach_templates_active_idx
  ON outreach_templates (active, status);

CREATE OR REPLACE FUNCTION public.touch_outreach_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS outreach_templates_updated_at ON outreach_templates;
CREATE TRIGGER outreach_templates_updated_at
  BEFORE UPDATE ON outreach_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_outreach_template_updated_at();

-- Una plantilla de ejemplo, en borrador, para que la pantalla no arranque
-- vacía y se vea cómo se usan los marcadores.
INSERT INTO outreach_templates (name, body, variables, category, status)
SELECT
  'Presentación FORCOM',
  E'Hola{{1}}, te escribo de FORCOM, fabricante argentino de equipamiento para punto de venta.\n\nVimos que trabajan en {{2}} y quería contarte que fabricamos los equipos acá, con repuestos y garantía directa.\n\n¿Te interesa que te pase información?',
  '["nombre de contacto", "rubro"]'::jsonb,
  'marketing',
  'borrador'
WHERE NOT EXISTS (SELECT 1 FROM outreach_templates);


-- ============================================================
-- 2. Trazabilidad del contacto en frío
-- ============================================================
-- Sin esto no se puede saber a quién ya se le escribió, y se terminaría
-- insistiéndole al mismo prospecto en cada tanda.
ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS outreach_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outreach_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS crm_contacts_outreach_idx
  ON crm_contacts (outreach_at DESC NULLS LAST);


-- ============================================================
-- 3. Tope diario de mensajes en frío
-- ============================================================
-- El contador ya existe para las consultas de búsqueda; se le agrega una
-- columna en vez de crear otra tabla. Va en la base y no en memoria
-- porque el server es serverless: no hay estado entre pedidos.
ALTER TABLE prospect_api_usage
  ADD COLUMN IF NOT EXISTS cold_messages INTEGER NOT NULL DEFAULT 0;

COMMENT ON TABLE prospect_api_usage IS
  'Contadores diarios con tope: consultas a la API de búsqueda y mensajes en frío.';

-- Reserva un cupo de mensaje en frío, de forma atómica. Se llama ANTES
-- de mandar: si devuelve allowed=false no hay que enviar nada.
--
-- El incremento ocurre igual cuando no está permitido, y es a propósito:
-- así dos pedidos simultáneos no pueden colarse los dos por el mismo
-- último cupo. El costo es que un rechazo "gasta" un número del contador,
-- lo cual no importa porque el contador solo existe para frenar.
CREATE OR REPLACE FUNCTION public.reserve_cold_message(p_limit integer)
RETURNS TABLE (used integer, allowed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_used integer;
BEGIN
  INSERT INTO prospect_api_usage (day, cold_messages)
  VALUES (CURRENT_DATE, 1)
  ON CONFLICT (day) DO UPDATE SET cold_messages = prospect_api_usage.cold_messages + 1
  RETURNING cold_messages INTO v_used;

  RETURN QUERY SELECT v_used, v_used <= p_limit;
END;
$$;

-- Devuelve el cupo si el envío falló, para no castigar al operador por un
-- error de red o de Evolution.
CREATE OR REPLACE FUNCTION public.release_cold_message()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE prospect_api_usage
     SET cold_messages = GREATEST(cold_messages - 1, 0)
   WHERE day = CURRENT_DATE;
$$;

REVOKE ALL ON FUNCTION public.reserve_cold_message(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_cold_message() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_cold_message(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_cold_message() TO authenticated, service_role;


-- ============================================================
-- 4. Marca de mensajes en frío en el historial
-- ============================================================
-- Un mensaje saliente puede ser una respuesta dentro de una conversación
-- o el primer contacto en frío. Distinguirlos permite medir después qué
-- porcentaje contesta, y saber con qué plantilla se abrió cada charla.
ALTER TABLE crm_messages
  ADD COLUMN IF NOT EXISTS is_outreach BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES outreach_templates(id) ON DELETE SET NULL;


-- ============================================================
-- 5. RLS
-- ============================================================
ALTER TABLE outreach_templates ENABLE ROW LEVEL SECURITY;

-- Leer: cualquier miembro (un agente necesita elegir plantilla para enviar).
DROP POLICY IF EXISTS "Members can read outreach_templates" ON outreach_templates;
CREATE POLICY "Members can read outreach_templates" ON outreach_templates FOR SELECT
  USING (public.current_admin_role() IS NOT NULL);

-- Escribir: solo owner/admin. Una plantilla aprobada por Meta es un
-- compromiso de la empresa; que un agente pueda editarle el texto a una
-- plantilla ya aprobada sería una forma silenciosa de saltearse la
-- aprobación.
DROP POLICY IF EXISTS "Owner/admin can manage outreach_templates" ON outreach_templates;
CREATE POLICY "Owner/admin can manage outreach_templates" ON outreach_templates FOR ALL
  USING (public.current_admin_role() IN ('owner', 'admin'))
  WITH CHECK (public.current_admin_role() IN ('owner', 'admin'));


-- ============================================================
-- 6. Verificación — pegar el resultado
-- ============================================================
SELECT name, status, category, jsonb_array_length(variables) AS variables
  FROM outreach_templates;

SELECT count(*) FILTER (WHERE outreach_at IS NOT NULL) AS ya_contactados,
       count(*)                                        AS total_clientes
  FROM crm_contacts;

SELECT day, cse_queries, cold_messages FROM prospect_api_usage ORDER BY day DESC LIMIT 3;
