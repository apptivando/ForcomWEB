-- ============================================================
-- 013 — Líneas de WhatsApp: la oficial y las de los vendedores (20/08/2026)
-- FALTA CORRER. Ejecutar en Supabase Dashboard > SQL Editor, entero.
--
-- Requiere 001, 002, 010, 011 y 012.
--
-- DOS SISTEMAS QUE NO SE MEZCLAN
-- La línea oficial de Centroficina va por Meta Cloud API y es la que se
-- atiende desde la Bandeja. Las ~10 líneas de los vendedores van por Baileys
-- (Evolution) y NO se operan desde la plataforma: solo registran lo que se
-- habló, para que quede en la ficha del cliente y se pueda analizar después.
--
-- Los mensajes de las dos viven en las MISMAS tablas (`crm_conversations` /
-- `crm_messages`) y no en tablas propias, por una razón concreta: la línea de
-- tiempo del cliente tiene que mostrar todo junto, venga del canal que venga.
-- Con tablas separadas habría que duplicar el esquema y toda la lógica de la
-- línea de tiempo.
--
-- Lo que los mantiene separados es `wa_lines.kind` y **un solo filtro en
-- `listConversations`**: la Bandeja muestra únicamente `kind = 'meta'`. Ese
-- filtro vive en un solo lugar a propósito, para que no se pueda olvidar.
--
-- Meta y Baileys no conviven en el MISMO número: activar Cloud API en una
-- línea hace que Baileys deje de poder descifrar sus mensajes. Por eso son
-- números distintos.
-- ============================================================


-- ============================================================
-- 1. Las líneas
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  -- 'meta' se atiende desde la Bandeja; 'baileys' solo registra.
  kind          TEXT NOT NULL DEFAULT 'baileys' CHECK (kind IN ('meta', 'baileys')),
  -- Nombre de la instancia en Evolution. Null para las de Meta, que no pasan
  -- por Evolution. Es la clave por la que el webhook resuelve a qué línea
  -- pertenece cada evento.
  instance      TEXT UNIQUE,
  -- El número de la línea, en dígitos sin '+'. Informativo.
  phone         TEXT,
  -- De qué vendedor es. Null para la oficial, que es de la empresa.
  member_id     UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  -- Último estado que reportó Evolution: open | close | connecting.
  conn_state    TEXT,
  conn_checked_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  -- La línea principal, a la que se asignan las conversaciones que se abren
  -- desde la plataforma. Solo puede haber una.
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS wa_lines_one_primary_idx
  ON wa_lines (is_primary) WHERE is_primary;

CREATE INDEX IF NOT EXISTS wa_lines_member_idx ON wa_lines (member_id);

CREATE OR REPLACE FUNCTION public.touch_wa_line_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wa_lines_updated_at ON wa_lines;
CREATE TRIGGER wa_lines_updated_at
  BEFORE UPDATE ON wa_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_wa_line_updated_at();


-- ============================================================
-- 2. Cada conversación sabe de qué línea vino
-- ============================================================
-- Sin esto, la misma empresa hablando con el mismo cliente desde dos líneas
-- distintas sería una sola conversación revuelta, y la Bandeja no podría
-- distinguir lo que le toca atender de lo que solo se registra.
ALTER TABLE crm_conversations
  ADD COLUMN IF NOT EXISTS line_id UUID REFERENCES wa_lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS crm_conversations_line_idx ON crm_conversations (line_id);

-- Un contacto tiene una conversación abierta POR LÍNEA. Sin esto, dos
-- vendedores hablando con el mismo cliente compartirían hilo, y los mensajes
-- de uno aparecerían mezclados con los del otro.
--
-- Antes de poner el índice hay que cerrar los duplicados que pudieran existir:
-- si quedara alguno, el CREATE UNIQUE INDEX falla y aborta la migración
-- entera. Se conserva la más reciente de cada par.
UPDATE crm_conversations c
   SET status = 'closed'
 WHERE c.status = 'open'
   AND EXISTS (
     SELECT 1 FROM crm_conversations o
      WHERE o.contact_id = c.contact_id
        AND o.status = 'open'
        AND o.line_id IS NOT DISTINCT FROM c.line_id
        AND (o.last_message_at, o.created_at, o.id) > (c.last_message_at, c.created_at, c.id)
   );

DROP INDEX IF EXISTS crm_conversations_contact_line_open_idx;
CREATE UNIQUE INDEX crm_conversations_contact_line_open_idx
  ON crm_conversations (contact_id, line_id)
  WHERE status = 'open';


-- ============================================================
-- 3. La línea oficial y el backfill
-- ============================================================
-- Se crea la línea principal y se le asignan todas las conversaciones que ya
-- existen: hasta hoy todas venían del número de la empresa.
--
-- `instance` queda en NULL a propósito. El webhook la completa solo la primera
-- vez que llega un mensaje cuya instancia coincide con EVOLUTION_INSTANCE —
-- así no hay que escribir acá un valor que solo conoce el entorno, y la
-- migración no puede quedar desincronizada con la variable.
INSERT INTO wa_lines (name, kind, is_primary, active)
SELECT 'Centroficina (línea oficial)', 'meta', true, true
WHERE NOT EXISTS (SELECT 1 FROM wa_lines WHERE is_primary);

UPDATE crm_conversations
   SET line_id = (SELECT id FROM wa_lines WHERE is_primary LIMIT 1)
 WHERE line_id IS NULL;


-- ============================================================
-- 4. Un origen más: los clientes que aparecen por un vendedor
-- ============================================================
ALTER TABLE crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_origin_check;
ALTER TABLE crm_contacts ADD CONSTRAINT crm_contacts_origin_check
  CHECK (origin IN ('busqueda', 'whatsapp', 'formulario', 'manual', 'vendedor'));


-- ============================================================
-- 5. Números excluidos por ser personales
-- ============================================================
-- Conectar la línea de un vendedor registra TODAS sus conversaciones de ese
-- número, no solo las de trabajo. El análisis marca las de tono personal y
-- desde la pantalla se excluye el número y se borra lo ya guardado.
--
-- Tabla aparte y no una columna en `crm_contacts` porque la exclusión tiene
-- que **sobrevivir al borrado del contacto**: si fuera una columna, se iría
-- con la purga y el próximo mensaje volvería a crear la ficha.
CREATE TABLE IF NOT EXISTS wa_excluded_numbers (
  phone       TEXT PRIMARY KEY,
  reason      TEXT,
  excluded_by UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/**
 * Excluye un número y borra todo rastro suyo.
 *
 * Borrar y no solo "dejar de registrar de acá en adelante": lo que se guardó
 * antes de detectar que la conversación era personal sigue siendo una
 * conversación personal guardada. El CASCADE de `crm_contacts` se lleva
 * conversaciones, mensajes y eventos.
 */
CREATE OR REPLACE FUNCTION public.exclude_and_purge_number(
  p_phone  text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (contacts_deleted integer, messages_deleted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor    uuid;
  v_contacts integer := 0;
  v_messages integer := 0;
BEGIN
  IF public.current_admin_role() NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'solo owner o admin pueden excluir un número';
  END IF;

  SELECT user_id INTO v_actor FROM admin_members WHERE user_id = auth.uid();

  INSERT INTO wa_excluded_numbers (phone, reason, excluded_by)
  VALUES (p_phone, p_reason, v_actor)
  ON CONFLICT (phone) DO UPDATE SET reason = excluded.reason;

  SELECT count(*)::integer INTO v_messages
    FROM crm_messages m
    JOIN crm_conversations c ON c.id = m.conversation_id
    JOIN crm_contacts k ON k.id = c.contact_id
   WHERE k.phone = p_phone;

  WITH gone AS (DELETE FROM crm_contacts WHERE phone = p_phone RETURNING 1)
  SELECT count(*)::integer INTO v_contacts FROM gone;

  RETURN QUERY SELECT v_contacts, v_messages;
END;
$$;

REVOKE ALL ON FUNCTION public.exclude_and_purge_number(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exclude_and_purge_number(text, text) TO authenticated;


-- ============================================================
-- 6. RLS
-- ============================================================
ALTER TABLE wa_lines            ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_excluded_numbers ENABLE ROW LEVEL SECURITY;

-- Leer las líneas: cualquier miembro (la Bandeja necesita saber de cuál vino
-- cada conversación).
DROP POLICY IF EXISTS "Members can read wa_lines" ON wa_lines;
CREATE POLICY "Members can read wa_lines" ON wa_lines FOR SELECT
  USING (public.current_admin_role() IS NOT NULL);

-- Administrarlas: solo owner/admin. Conectar una línea es vincular un
-- dispositivo al WhatsApp de una persona; no es una acción de todos los días.
DROP POLICY IF EXISTS "Owner/admin can manage wa_lines" ON wa_lines;
CREATE POLICY "Owner/admin can manage wa_lines" ON wa_lines FOR ALL
  USING (public.current_admin_role() IN ('owner', 'admin'))
  WITH CHECK (public.current_admin_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Owner/admin can manage exclusions" ON wa_excluded_numbers;
CREATE POLICY "Owner/admin can manage exclusions" ON wa_excluded_numbers FOR ALL
  USING (public.current_admin_role() IN ('owner', 'admin'))
  WITH CHECK (public.current_admin_role() IN ('owner', 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wa_lines TO authenticated;
GRANT ALL ON TABLE wa_lines TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wa_excluded_numbers TO authenticated;
GRANT ALL ON TABLE wa_excluded_numbers TO service_role;


-- ============================================================
-- 7. La línea de tiempo del cliente muestra de qué línea vino cada mensaje
-- ============================================================
-- Se recrea `contact_timeline` sumando el nombre de la línea al `meta` de cada
-- mensaje de WhatsApp. Sin esto, en la ficha no se distinguiría lo que habló
-- un vendedor de lo que salió por la línea oficial.
CREATE OR REPLACE FUNCTION public.contact_timeline(
  p_contact_id uuid,
  p_before     timestamptz DEFAULT NULL,
  p_limit      integer     DEFAULT 40
)
RETURNS TABLE (
  source   text,
  ref_id   uuid,
  kind     text,
  at       timestamptz,
  body     text,
  meta     jsonb,
  actor_id uuid
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH cutoff AS (SELECT coalesce(p_before, 'infinity'::timestamptz) AS ts)
  SELECT * FROM (
    SELECT 'event'::text, e.id, e.kind, e.created_at, e.body, e.meta, e.actor_member_id
      FROM crm_events e, cutoff
     WHERE e.contact_id = p_contact_id AND e.created_at < cutoff.ts

    UNION ALL

    SELECT 'wa'::text, m.id,
           CASE WHEN m.direction = 'in' THEN 'wa_in' ELSE 'wa_out' END,
           m.created_at,
           coalesce(m.content_text, '[' || m.content_type || ']'),
           jsonb_build_object('conversation_id', m.conversation_id,
                              'is_outreach',     m.is_outreach,
                              'ai',              m.ai_generated,
                              'media_url',       m.media_url,
                              'line',            l.name,
                              'line_kind',       l.kind),
           m.sender_member_id
      FROM crm_messages m
      JOIN crm_conversations c ON c.id = m.conversation_id
      LEFT JOIN wa_lines l ON l.id = c.line_id, cutoff
     WHERE c.contact_id = p_contact_id AND m.created_at < cutoff.ts

    UNION ALL

    SELECT 'form'::text, f.id, 'form_message', f.created_at, f.message,
           jsonb_build_object('name', f.name, 'email', f.email,
                              'industry', f.industry, 'status', f.status),
           NULL::uuid
      FROM contact_messages f, cutoff
     WHERE f.contact_id = p_contact_id AND f.created_at < cutoff.ts

    UNION ALL

    SELECT 'search'::text, s.id, 'from_search', r.created_at,
           s.rubro || ' · ' || s.locality,
           jsonb_build_object('search_id', s.id, 'rubro', s.rubro, 'locality', s.locality),
           s.created_by
      FROM prospect_search_results r
      JOIN prospect_searches s ON s.id = r.search_id, cutoff
     WHERE r.contact_id = p_contact_id AND r.created_at < cutoff.ts
  ) t(source, ref_id, kind, at, body, meta, actor_id)
  ORDER BY at DESC
  LIMIT greatest(coalesce(p_limit, 40), 1);
$$;

REVOKE ALL ON FUNCTION public.contact_timeline(uuid, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contact_timeline(uuid, timestamptz, integer)
  TO authenticated, service_role;


-- ============================================================
-- 8. Verificación — pegar el resultado
-- ============================================================
SELECT name, kind, is_primary, active, coalesce(instance, '(la completa el webhook)') AS instancia
  FROM wa_lines ORDER BY is_primary DESC, name;

SELECT count(*) FILTER (WHERE line_id IS NULL) AS conversaciones_sin_linea,
       count(*)                                AS total
  FROM crm_conversations;

-- Cada mensaje de la línea de tiempo tiene que decir de qué línea vino.
SELECT source, kind, meta ->> 'line' AS linea, left(coalesce(body, ''), 40) AS body
  FROM public.contact_timeline(
         (SELECT contact_id FROM crm_conversations
           ORDER BY last_message_at DESC NULLS LAST LIMIT 1),
         NULL, 5);
