-- ============================================================
-- 014 — Análisis de las conversaciones de los vendedores (20/08/2026)
-- FALTA CORRER. Ejecutar en Supabase Dashboard > SQL Editor, entero.
--
-- Requiere 001, 002, 010, 011, 012 y 013.
--
-- LO PRIMERO ES NO USAR IA DONDE NO HACE FALTA
-- "El cliente preguntó y nadie contestó" y "cuánto tarda en responder" se
-- calculan mirando la dirección y la fecha de los mensajes: exacto, gratis e
-- instantáneo. Eso es la sección 1 y no cuesta un centavo.
--
-- La IA queda para lo que de verdad la necesita: el caso sutil de "contestó
-- pero no respondió lo que le preguntaron", las oportunidades que se dejaron
-- pasar, y el tono. Eso es la sección 2.
-- ============================================================


-- ============================================================
-- 1. Las métricas que no necesitan IA
-- ============================================================
-- La mediana y no el promedio: un mensaje que entró a las 23h y se contestó a
-- las 9h de la mañana siguiente son diez horas que arruinan cualquier
-- promedio, aunque el vendedor haya contestado todo lo demás en minutos.
CREATE OR REPLACE FUNCTION public.seller_stats(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS TABLE (
  line_id            uuid,
  line_name          text,
  member_id          uuid,
  conversations      integer,
  messages_in        integer,
  messages_out       integer,
  median_response_s  integer,
  unanswered         integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH msgs AS (
    SELECT c.line_id,
           m.conversation_id,
           m.direction,
           m.created_at,
           -- El primer mensaje nuestro posterior a éste, dentro de la misma
           -- conversación. Sobre un entrante, es lo que tardamos en contestar.
           min(m.created_at) FILTER (WHERE m.direction = 'out') OVER (
             PARTITION BY m.conversation_id
             ORDER BY m.created_at
             ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING
           ) AS next_out
      FROM crm_messages m
      JOIN crm_conversations c ON c.id = m.conversation_id
     WHERE m.created_at >= p_from AND m.created_at < p_to
  ),
  -- Una conversación cuenta como "sin contestar" cuando su ÚLTIMO mensaje —de
  -- toda su historia, no solo del período— vino del cliente. Mirar solo el
  -- período diría que quedó sin respuesta algo que se contestó al otro día.
  last_msg AS (
    SELECT DISTINCT ON (m.conversation_id)
           m.conversation_id, c.line_id, m.direction
      FROM crm_messages m
      JOIN crm_conversations c ON c.id = m.conversation_id
     ORDER BY m.conversation_id, m.created_at DESC
  )
  SELECT l.id,
         l.name,
         l.member_id,
         (SELECT count(DISTINCT conversation_id)::integer FROM msgs WHERE msgs.line_id = l.id),
         (SELECT count(*)::integer FROM msgs WHERE msgs.line_id = l.id AND direction = 'in'),
         (SELECT count(*)::integer FROM msgs WHERE msgs.line_id = l.id AND direction = 'out'),
         (SELECT percentile_cont(0.5) WITHIN GROUP (
                   ORDER BY EXTRACT(EPOCH FROM (next_out - created_at))
                 )::integer
            FROM msgs
           WHERE msgs.line_id = l.id AND direction = 'in' AND next_out IS NOT NULL),
         (SELECT count(*)::integer FROM last_msg
           WHERE last_msg.line_id = l.id AND last_msg.direction = 'in')
    FROM wa_lines l
   ORDER BY l.kind, l.name;
$$;

REVOKE ALL ON FUNCTION public.seller_stats(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_stats(timestamptz, timestamptz)
  TO authenticated, service_role;


-- ============================================================
-- 2. Los hallazgos de la IA
-- ============================================================
-- Una fila por conversación y por día. La clave única evita analizar dos veces
-- lo mismo si el cron corre de más.
CREATE TABLE IF NOT EXISTS conversation_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES crm_conversations(id) ON DELETE CASCADE,
  line_id         UUID REFERENCES wa_lines(id) ON DELETE SET NULL,
  member_id       UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  day             DATE NOT NULL,

  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'done', 'failed', 'skipped')),
  model           TEXT,
  error           TEXT,

  -- Consultas que quedaron sin responder de verdad: el caso sutil de haber
  -- contestado sin responder lo que preguntaron.
  unanswered      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Preguntó por un producto y no se cotizó, o se cerró sin próximo paso.
  missed          JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- {"nivel": "bien|regular|malo", "nota": "..."} — señal para mirar, nunca
  -- una calificación del vendedor.
  tone            JSONB,
  -- La conversación es de tono personal, no de trabajo. Habilita excluir el
  -- número y borrar lo registrado.
  personal        BOOLEAN NOT NULL DEFAULT false,
  summary         TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,

  UNIQUE (conversation_id, day)
);

CREATE INDEX IF NOT EXISTS conversation_reviews_pending_idx
  ON conversation_reviews (created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS conversation_reviews_member_day_idx
  ON conversation_reviews (member_id, day DESC);
CREATE INDEX IF NOT EXISTS conversation_reviews_personal_idx
  ON conversation_reviews (personal) WHERE personal;


-- ============================================================
-- 3. Encolar el día
-- ============================================================
-- Solo las conversaciones de líneas de VENDEDOR que tuvieron movimiento ese
-- día. La línea oficial no se analiza: ahí ya hay alguien atendiendo en vivo.
--
-- Idempotente: correrlo dos veces sobre el mismo día no duplica ni reencola lo
-- que ya se analizó.
CREATE OR REPLACE FUNCTION public.enqueue_conversation_reviews(p_day date)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH nuevas AS (
    INSERT INTO conversation_reviews (conversation_id, line_id, member_id, day)
    SELECT DISTINCT c.id, c.line_id, l.member_id, p_day
      FROM crm_conversations c
      JOIN wa_lines l ON l.id = c.line_id
      JOIN crm_messages m ON m.conversation_id = c.id
     WHERE l.kind = 'baileys'
       AND m.created_at >= p_day::timestamptz
       AND m.created_at <  (p_day + 1)::timestamptz
    ON CONFLICT (conversation_id, day) DO NOTHING
    RETURNING 1
  ) SELECT count(*)::integer FROM nuevas;
$$;

/** Reclamo atómico, igual que el del enriquecedor de prospectos. */
CREATE OR REPLACE FUNCTION public.claim_conversation_reviews(p_limit integer)
RETURNS SETOF conversation_reviews
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE conversation_reviews
     SET status = 'running'
   WHERE id IN (
     SELECT id FROM conversation_reviews
      WHERE status = 'pending'
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT GREATEST(coalesce(p_limit, 0), 0)
   )
  RETURNING *;
$$;

/** Watchdog: lo que quedó colgado en 'running' vuelve a la cola. */
CREATE OR REPLACE FUNCTION public.requeue_stale_reviews()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stale AS (
    UPDATE conversation_reviews SET status = 'pending'
     WHERE status = 'running' AND created_at < NOW() - INTERVAL '30 minutes'
    RETURNING 1
  ) SELECT count(*)::integer FROM stale;
$$;

REVOKE ALL ON FUNCTION public.enqueue_conversation_reviews(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_conversation_reviews(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.requeue_stale_reviews() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_conversation_reviews(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_conversation_reviews(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.requeue_stale_reviews() TO service_role;


-- ============================================================
-- 4. La transcripción que se le manda a la IA
-- ============================================================
-- En SQL y no armándola en JS: así el worker hace una consulta por
-- conversación en vez de traerse los mensajes y pegarlos, y el recorte queda
-- del lado de la base.
--
-- Solo el texto y quién habló. No hace falta más para juzgar si se respondió
-- una consulta, y mandar menos es mandar más barato.
CREATE OR REPLACE FUNCTION public.conversation_transcript(
  p_conversation_id uuid,
  p_max_messages    integer DEFAULT 60
)
RETURNS TABLE (quien text, texto text, cuando timestamptz)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT * FROM (
    SELECT CASE WHEN m.direction = 'in' THEN 'cliente' ELSE 'vendedor' END,
           coalesce(m.content_text, '[' || m.content_type || ']'),
           m.created_at
      FROM crm_messages m
     WHERE m.conversation_id = p_conversation_id
     ORDER BY m.created_at DESC
     LIMIT GREATEST(coalesce(p_max_messages, 60), 1)
  ) t(quien, texto, cuando)
  ORDER BY cuando;
$$;

REVOKE ALL ON FUNCTION public.conversation_transcript(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.conversation_transcript(uuid, integer)
  TO authenticated, service_role;


-- ============================================================
-- 5. Un modelo aparte para el análisis
-- ============================================================
-- El modelo que le contesta a un cliente y el que clasifica conversaciones de
-- a cientos no tienen por qué ser el mismo: uno conversa y se paga por
-- calidad, el otro etiqueta en volumen y se paga por cantidad. Null = usa el
-- mismo del asistente.
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS analysis_model TEXT;

COMMENT ON COLUMN ai_config.analysis_model IS
  'Modelo para el análisis de conversaciones de vendedores. Null usa `model`.';


-- ============================================================
-- 6. RLS
-- ============================================================
ALTER TABLE conversation_reviews ENABLE ROW LEVEL SECURITY;

-- Leer: solo owner/admin. Los hallazgos son sobre cómo trabajó una persona; no
-- son para que los lea cualquiera del equipo.
DROP POLICY IF EXISTS "Owner/admin can read reviews" ON conversation_reviews;
CREATE POLICY "Owner/admin can read reviews" ON conversation_reviews FOR SELECT
  USING (public.current_admin_role() IN ('owner', 'admin'));

-- Escribir: nadie desde el navegador. Las escribe el worker con la service
-- key, que bypasea RLS.
GRANT SELECT ON TABLE conversation_reviews TO authenticated;
GRANT ALL ON TABLE conversation_reviews TO service_role;


-- ============================================================
-- 7. Verificación — pegar el resultado
-- ============================================================
-- Las métricas de los últimos 7 días. Con una sola línea (la oficial) va a
-- devolver una fila; los vendedores aparecen a medida que se conecten.
SELECT line_name, conversations, messages_in, messages_out,
       median_response_s, unanswered
  FROM public.seller_stats(NOW() - INTERVAL '7 days', NOW());

SELECT count(*) AS analisis_encolados FROM conversation_reviews;

-- Debe devolver 0 mientras no haya líneas de vendedores conectadas.
SELECT public.enqueue_conversation_reviews(CURRENT_DATE - 1) AS encoladas_de_ayer;
