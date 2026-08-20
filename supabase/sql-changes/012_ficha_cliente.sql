-- ============================================================
-- 012 — Ficha de cliente: línea de tiempo unificada (20/08/2026)
-- FALTA CORRER. Ejecutar en Supabase Dashboard > SQL Editor, entero.
--
-- Requiere 001, 002, 010 y **011**. La 011 no es opcional acá: la función
-- contact_timeline lee crm_messages.is_outreach, que agrega esa migración, y
-- Postgres valida el cuerpo de una función LANGUAGE sql al crearla — sin la
-- 011 el CREATE falla con "column m.is_outreach does not exist".
--
-- POR QUÉ UNA TABLA DE EVENTOS Y NO UNA DE NOTAS
-- La ficha muestra una sola lista cronológica que mezcla notas internas con lo
-- que pasó solo (una oportunidad que cambió de etapa, una edición). Si las
-- notas vivieran en una tabla y la auditoría en otra, cada página de esa lista
-- sería un merge en JS de dos listas paginadas por separado — que es
-- incorrecto apenas pasás de la primera página. Con una tabla es un ORDER BY.
--
-- La diferencia de ciclo de vida (las notas se editan, los eventos no) se
-- sostiene en RLS: la política de INSERT solo acepta kind='note'; los eventos
-- los escribe un trigger SECURITY DEFINER, que bypasea RLS. Nadie puede
-- fabricar ni retocar un evento de sistema desde el navegador.
-- ============================================================


-- ============================================================
-- 1. La tabla
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id       UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN (
                     'note',          -- la escribe una persona; editable
                     'deal_created',  -- de acá para abajo: sistema, inmutable
                     'deal_moved',
                     'deal_updated',
                     'deal_deleted',
                     'edited'         -- alguien cambió datos de la ficha
                   )),
  body             TEXT,
  -- Datos estructurados del evento. Los nombres de etapa se guardan COPIADOS
  -- acá y no por id: si mañana renombran "Cotizado", la historia tiene que
  -- seguir diciendo lo que pasó ese día.
  meta             JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_member_id  UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Una nota vacía no es una nota.
  CONSTRAINT crm_events_note_has_body
    CHECK (kind <> 'note' OR btrim(coalesce(body, '')) <> '')
);

-- El único acceso que existe: los eventos de UN contacto, del más nuevo al más
-- viejo. Compuesto para que paginar por cursor sea recorrer el índice y no
-- ordenar en memoria.
CREATE INDEX IF NOT EXISTS crm_events_contact_created_idx
  ON crm_events (contact_id, created_at DESC);

-- El mismo tratamiento para los mensajes: hoy solo hay índice por
-- conversation_id, así que traer los últimos 40 de un contacto con 500
-- mensajes ordena 500 filas en memoria cada vez.
CREATE INDEX IF NOT EXISTS crm_messages_conversation_created_idx
  ON crm_messages (conversation_id, created_at DESC);


-- ============================================================
-- 2. Lo que no se puede cambiar de una nota
-- ============================================================
-- RLS controla QUIÉN edita, no QUÉ columnas. Sin esto, el autor de una nota
-- podría reasignársela a otro miembro en el mismo UPDATE con el que corrige un
-- error de tipeo.
CREATE OR REPLACE FUNCTION public.freeze_crm_event_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.id              := OLD.id;
  NEW.contact_id      := OLD.contact_id;
  NEW.kind            := OLD.kind;
  NEW.actor_member_id := OLD.actor_member_id;
  NEW.created_at      := OLD.created_at;
  NEW.updated_at      := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_events_freeze_identity ON crm_events;
CREATE TRIGGER crm_events_freeze_identity
  BEFORE UPDATE ON crm_events
  FOR EACH ROW
  EXECUTE FUNCTION public.freeze_crm_event_identity();


-- ============================================================
-- 3. Los movimientos del Pipeline se registran solos
-- ============================================================
-- Va como trigger y no como escritura desde la Server Action por una sola
-- razón: si es explícito, se puede olvidar. Hoy ya hay dos caminos que mueven
-- una oportunidad (la Server Action y el SQL Editor) y mañana puede haber un
-- tercero. Un historial con agujeros es peor que no tener historial, porque se
-- le cree.
--
-- El costo está en la rama del DELETE. Leer ese comentario antes de tocar nada.
CREATE OR REPLACE FUNCTION public.log_pipeline_deal_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_from  text;
  v_to    text;
BEGIN
  -- auth.uid() vale dentro del trigger cuando la escritura entra por PostgREST
  -- con el JWT del usuario. Cuando entra con la service key (un script, el
  -- worker) es NULL, y está bien: el evento queda como "del sistema". El
  -- SELECT contra admin_members evita que un uid que no sea miembro haga
  -- fallar la clave foránea y aborte el movimiento.
  SELECT user_id INTO v_actor FROM admin_members WHERE user_id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    SELECT name INTO v_to FROM pipeline_stages WHERE id = NEW.stage_id;
    INSERT INTO crm_events (contact_id, kind, body, meta, actor_member_id)
    VALUES (NEW.contact_id, 'deal_created', NEW.title,
            jsonb_build_object('deal_id', NEW.id, 'stage', v_to, 'value', NEW.value),
            v_actor);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
      SELECT name INTO v_from FROM pipeline_stages WHERE id = OLD.stage_id;
      SELECT name INTO v_to   FROM pipeline_stages WHERE id = NEW.stage_id;
      INSERT INTO crm_events (contact_id, kind, body, meta, actor_member_id)
      VALUES (NEW.contact_id, 'deal_moved', NEW.title,
              jsonb_build_object('deal_id', NEW.id, 'from', v_from, 'to', v_to),
              v_actor);
    ELSIF (NEW.title, NEW.value, NEW.notes) IS DISTINCT FROM (OLD.title, OLD.value, OLD.notes) THEN
      INSERT INTO crm_events (contact_id, kind, body, meta, actor_member_id)
      VALUES (NEW.contact_id, 'deal_updated', NEW.title,
              jsonb_build_object('deal_id', NEW.id,
                                 'value_from', OLD.value, 'value_to', NEW.value),
              v_actor);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- OJO: pipeline_deals tiene ON DELETE CASCADE desde crm_contacts. Cuando
    -- se borra un cliente, Postgres borra primero la fila padre y después
    -- cascadea a las hijas — así que acá el contacto YA NO EXISTE, y un INSERT
    -- en crm_events referenciándolo reventaría con violación de clave foránea
    -- y abortaría el DELETE entero: deleteClient() dejaría de funcionar, con
    -- un error que no le apunta a nadie al trigger.
    --
    -- Este IF EXISTS es lo único que lo evita. NO SACARLO por parecer
    -- redundante.
    IF EXISTS (SELECT 1 FROM crm_contacts WHERE id = OLD.contact_id) THEN
      INSERT INTO crm_events (contact_id, kind, body, meta, actor_member_id)
      VALUES (OLD.contact_id, 'deal_deleted', OLD.title,
              jsonb_build_object('deal_id', OLD.id), v_actor);
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS pipeline_deals_log_events ON pipeline_deals;
CREATE TRIGGER pipeline_deals_log_events
  AFTER INSERT OR UPDATE OR DELETE ON pipeline_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_pipeline_deal_event();


-- ============================================================
-- 4. La línea de tiempo, en una sola consulta
-- ============================================================
-- Cuatro fuentes (eventos, WhatsApp, formulario web, de qué búsqueda salió)
-- normalizadas a la misma forma y ordenadas juntas.
--
-- POR QUÉ ACÁ Y NO EN JS
-- Mezclando en JS habría que traer las cuatro listas con un tope cada una y
-- ordenarlas. Funciona para la primera página y se rompe en la segunda: un
-- cliente con 500 mensajes de WhatsApp tapa el mensaje del formulario de hace
-- un año, porque el tope de la fuente de WhatsApp se agota antes de llegar —
-- y ese mensaje viejo suele ser justo el dato valioso. Acá el orden es global.
--
-- SIN SECURITY DEFINER a propósito: así el RLS de cada tabla de origen sigue
-- aplicando tal cual y esta función no reimplementa ningún control de acceso.
--
-- Paginación por cursor (p_before) y no por OFFSET: con OFFSET, un mensaje que
-- entra mientras se pagina corre todo un lugar y repite una fila.
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
                              'media_url',       m.media_url),
           m.sender_member_id
      FROM crm_messages m
      JOIN crm_conversations c ON c.id = m.conversation_id, cutoff
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
-- 5. RLS
-- ============================================================
ALTER TABLE crm_events ENABLE ROW LEVEL SECURITY;

-- Leer: cualquier miembro, como el resto del CRM.
DROP POLICY IF EXISTS "Members can read crm_events" ON crm_events;
CREATE POLICY "Members can read crm_events" ON crm_events FOR SELECT
  USING (public.current_admin_role() IS NOT NULL);

-- Escribir: SOLO notas, y SOLO a nombre propio. Un evento de sistema no se
-- puede fabricar desde el navegador. Los que escribe el trigger entran igual
-- porque SECURITY DEFINER bypasea RLS.
DROP POLICY IF EXISTS "Members can add own notes" ON crm_events;
CREATE POLICY "Members can add own notes" ON crm_events FOR INSERT
  WITH CHECK (
    public.current_admin_role() IS NOT NULL
    AND kind = 'note'
    AND actor_member_id = auth.uid()
  );

-- Editar y borrar: solo notas, solo el autor o un owner/admin. Un agente no
-- debería poder retocar la nota que escribió otro.
DROP POLICY IF EXISTS "Author or admin can edit notes" ON crm_events;
CREATE POLICY "Author or admin can edit notes" ON crm_events FOR UPDATE
  USING (kind = 'note'
         AND (actor_member_id = auth.uid()
              OR public.current_admin_role() IN ('owner', 'admin')))
  WITH CHECK (kind = 'note');

DROP POLICY IF EXISTS "Author or admin can delete notes" ON crm_events;
CREATE POLICY "Author or admin can delete notes" ON crm_events FOR DELETE
  USING (kind = 'note'
         AND (actor_member_id = auth.uid()
              OR public.current_admin_role() IN ('owner', 'admin')));

-- Supabase ya otorga estos permisos por default a las tablas nuevas del schema
-- public; van explícitos por si ese default cambia.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE crm_events TO authenticated;
GRANT ALL ON TABLE crm_events TO service_role;


-- ============================================================
-- 6. Las notas viejas pasan a ser notas de verdad
-- ============================================================
-- `crm_contacts.notes` es hoy un solo campo de texto compartido entre una
-- persona y una máquina: el enriquecedor le concatena sus propios hallazgos
-- (src/lib/prospects/enrich.ts). Por eso tocar una nota tenía que congelar la
-- ficha — no había forma de distinguir quién había escrito qué.
--
-- Se migra solo lo que escribió una persona: las fichas con manual_lock. Lo
-- que hay en las demás lo puso el enriquecedor y sigue donde está, como su
-- bloc de notas.
INSERT INTO crm_events (contact_id, kind, body, meta, created_at)
SELECT c.id, 'note', c.notes,
       '{"migrada_desde":"crm_contacts.notes"}'::jsonb,
       coalesce(c.updated_at, c.created_at)
  FROM crm_contacts c
 WHERE c.manual_lock
   AND btrim(coalesce(c.notes, '')) <> ''
   AND NOT EXISTS (
     SELECT 1 FROM crm_events e
      WHERE e.contact_id = c.id
        AND e.meta ->> 'migrada_desde' = 'crm_contacts.notes'
   );

COMMENT ON COLUMN crm_contacts.notes IS
  'Bloc del enriquecedor automático. Las notas de una persona van en crm_events (kind=note).';


-- ============================================================
-- 7. Verificación — pegar el resultado
-- ============================================================
SELECT count(*) FILTER (WHERE kind = 'note')  AS notas,
       count(*) FILTER (WHERE kind <> 'note') AS eventos_sistema,
       count(*)                               AS total
  FROM crm_events;

-- Tiene que aparecer pipeline_deals_log_events con tgenabled = 'O' (activo).
SELECT tgname, tgenabled FROM pg_trigger
 WHERE tgrelid = 'pipeline_deals'::regclass AND NOT tgisinternal;

-- Debe devolver filas para cualquier cliente que tenga historia.
SELECT source, kind, at, left(coalesce(body, ''), 60) AS body
  FROM public.contact_timeline(
         (SELECT contact_id FROM crm_conversations
           ORDER BY last_message_at DESC NULLS LAST LIMIT 1),
         NULL, 10);
