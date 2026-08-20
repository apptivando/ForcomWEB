-- ============================================================
-- 010 — Clientes unificados + prospección por búsqueda (19/08/2026)
-- FALTA CORRER. Ejecutar en Supabase Dashboard > SQL Editor, entero,
-- de una sola vez. Al final imprime un resumen de verificación.
--
-- Fases 7 y 8 del Track E.
--
-- `crm_contacts` deja de ser "los contactos de WhatsApp" y pasa a ser
-- la tabla ÚNICA de clientes. Los prospectos que trae el scraper de
-- Google Places entran acá mismo etiquetados con `origin`, igual que
-- los leads del formulario web. Motivo: si vivieran en una tabla
-- aparte habría que duplicar la lógica del Pipeline y de la Bandeja, y
-- un prospecto que después escribe por WhatsApp quedaría duplicado.
-- Así, `pipeline_deals` y `crm_conversations` funcionan sobre
-- prospectos sin una línea de código nueva.
--
-- Requiere 001 (current_admin_role, admin_members) y 002 (crm_*).
-- OJO: 002 figura como "FALTA CORRER" — confirmar que las tablas
-- crm_* existan antes de correr esta.
-- ============================================================


-- ============================================================
-- 1. Los dos nombres
-- ============================================================
-- El webhook de Evolution guardaba el `pushName` de WhatsApp en `name`
-- (el nombre de la PERSONA que escribe), y el scraper necesita guardar
-- la razón social del COMERCIO. Si compartieran columna, el primer
-- mensaje de WhatsApp convertiría "Farmacia del Sol" en "Juan".
--
-- El rename es correcto sin backfill: hoy el único código que inserta
-- en crm_contacts es el webhook, así que todo lo que hay en `name` ya
-- es un nombre de persona.
DO $$
BEGIN
  IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'crm_contacts' AND column_name = 'name')
     AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'crm_contacts' AND column_name = 'contact_name')
  THEN
    ALTER TABLE crm_contacts RENAME COLUMN name TO contact_name;
  END IF;
END $$;

ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS contact_name  TEXT;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS business_name TEXT;


-- ============================================================
-- 2. El teléfono deja de ser obligatorio
-- ============================================================
-- Un prospecto puede tener solo email, o solo sitio web.
-- El UNIQUE sobre phone NO se toca: en Postgres un índice único acepta
-- N filas con NULL (NULLS DISTINCT es el default), así que miles de
-- prospectos sin teléfono conviven, y el ON CONFLICT (phone) del
-- webhook de Evolution sigue funcionando igual porque el índice sigue
-- existiendo tal cual.
ALTER TABLE crm_contacts ALTER COLUMN phone DROP NOT NULL;


-- ============================================================
-- 3. Origen
-- ============================================================
-- El DEFAULT queda en 'whatsapp' a propósito y para siempre: el único
-- código que inserta sin especificar origen es el webhook de Evolution.
-- El scraper, el formulario y el alta manual lo mandan explícito.
-- De paso, esto deja bien etiquetadas las filas que ya existían (todas
-- del webhook) sin necesidad de un UPDATE de backfill.
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'whatsapp';

ALTER TABLE crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_origin_check;
ALTER TABLE crm_contacts ADD CONSTRAINT crm_contacts_origin_check
  CHECK (origin IN ('busqueda', 'whatsapp', 'formulario', 'manual'));


-- ============================================================
-- 4. Datos del prospecto
-- ============================================================
ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS email             TEXT,
  ADD COLUMN IF NOT EXISTS rubro             TEXT,
  ADD COLUMN IF NOT EXISTS locality          TEXT,
  ADD COLUMN IF NOT EXISTS address           TEXT,
  ADD COLUMN IF NOT EXISTS website           TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url      TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url     TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url      TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id   TEXT,
  ADD COLUMN IF NOT EXISTS google_maps_url   TEXT,
  ADD COLUMN IF NOT EXISTS google_synced_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rating            NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS reviews_count     INTEGER,
  ADD COLUMN IF NOT EXISTS whatsapp_phone    TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_source   TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_likely   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT NOT NULL DEFAULT 'skipped',
  ADD COLUMN IF NOT EXISTS enrichment_level  SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_error  TEXT,
  ADD COLUMN IF NOT EXISTS scrape_attempts   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_scraped_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manual_lock       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes             TEXT;

-- 'skipped' como default deja fuera de la cola del worker a los
-- contactos que ya existían (los de WhatsApp): no tienen sitio que
-- visitar. El scraper pone 'pending' explícito.
ALTER TABLE crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_enrichment_status_check;
ALTER TABLE crm_contacts ADD CONSTRAINT crm_contacts_enrichment_status_check
  CHECK (enrichment_status IN ('pending', 'running', 'done', 'failed', 'skipped'));

-- Hasta qué nivel de la cascada llegó: 0 solo Google Places, 1 sitio
-- web propio, 3 búsqueda en Google, 4 se agotó sin resultado. (No hay
-- nivel 2: las redes sociales nunca se visitan, solo se guarda la URL.)
ALTER TABLE crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_enrichment_level_check;
ALTER TABLE crm_contacts ADD CONSTRAINT crm_contacts_enrichment_level_check
  CHECK (enrichment_level BETWEEN 0 AND 4);

-- De dónde salió la evidencia de WhatsApp. 'link' = enlace wa.me en el
-- sitio; 'texto' = un teléfono junto a la palabra WhatsApp; 'busqueda'
-- = del resultado de Google del nivel 3; 'manual' = lo cargó una
-- persona. NUNCA se infiere de que el número parezca celular: eso va
-- en whatsapp_likely y no cuenta como contacto confirmado.
ALTER TABLE crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_whatsapp_source_check;
ALTER TABLE crm_contacts ADD CONSTRAINT crm_contacts_whatsapp_source_check
  CHECK (whatsapp_source IS NULL OR whatsapp_source IN ('link', 'texto', 'busqueda', 'manual'));

-- Nada de filas fantasma sin ningún identificador.
ALTER TABLE crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_needs_identity;
ALTER TABLE crm_contacts ADD CONSTRAINT crm_contacts_needs_identity
  CHECK (phone IS NOT NULL OR email IS NOT NULL OR google_place_id IS NOT NULL);


-- ============================================================
-- 5. Prioridad de contacto (columna generada)
-- ============================================================
-- 1 WhatsApp · 2 email · 3 teléfono · 4 sin contacto. Es el orden de
-- trabajo que pidió el negocio, calculado por la base para que no
-- pueda quedar desincronizado.
--
-- Sí es válida: una GENERATED ... STORED puede referenciar cualquier
-- columna NO generada de la misma fila — es su caso de uso. La única
-- exigencia es que la expresión sea IMMUTABLE, y CASE + IS NOT NULL lo
-- es (no lee catálogo, no depende de la sesión, no toca otras filas,
-- no usa NOW()). Distinto del intento fallido de 006 (products.fts),
-- que falló porque to_tsvector con la config como literal de texto
-- obliga a un lookup text→regconfig y por eso no es IMMUTABLE.
--
-- OJO PARA EL CÓDIGO: es de SOLO LECTURA. Cualquier insert/update que
-- incluya contact_tier revienta con "cannot insert a non-DEFAULT value
-- into column". Nunca hacer select('*') → upsert(row) sobre esta tabla.
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS contact_tier SMALLINT
  GENERATED ALWAYS AS (
    CASE
      WHEN whatsapp_phone IS NOT NULL THEN 1
      WHEN email          IS NOT NULL THEN 2
      WHEN phone          IS NOT NULL THEN 3
      ELSE 4
    END
  ) STORED;


-- ============================================================
-- 6. Índices
-- ============================================================
-- UNIQUE plano, NO parcial: un índice parcial (WHERE ... IS NOT NULL)
-- no sirve para inferir el ON CONFLICT desde PostgREST, que no puede
-- expresar el predicado. Plano y nullable es lo correcto: N NULLs
-- conviven igual que en phone.
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_google_place_id_key
  ON crm_contacts (google_place_id);

-- email SIN unique a propósito: las cadenas y franquicias comparten
-- info@lacadena.com.ar entre sucursales, y un UNIQUE ahí haría fallar
-- el enriquecimiento con un 23505 en vez de guardar el dato. La
-- deduplicación por email la hace upsert_prospect().
CREATE INDEX IF NOT EXISTS crm_contacts_email_idx    ON crm_contacts (email);
CREATE INDEX IF NOT EXISTS crm_contacts_origin_idx   ON crm_contacts (origin);
CREATE INDEX IF NOT EXISTS crm_contacts_tier_idx     ON crm_contacts (contact_tier, updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_contacts_locality_idx ON crm_contacts (locality);
CREATE INDEX IF NOT EXISTS crm_contacts_pending_idx
  ON crm_contacts (created_at) WHERE enrichment_status = 'pending';


-- ============================================================
-- 7. Búsquedas de prospectos
-- ============================================================
CREATE TABLE IF NOT EXISTS prospect_searches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubro          TEXT NOT NULL,
  locality       TEXT NOT NULL,
  query          TEXT NOT NULL,
  included_type  TEXT,
  status         TEXT NOT NULL DEFAULT 'running'
                 CHECK (status IN ('running', 'done', 'error')),
  results_count  INTEGER NOT NULL DEFAULT 0,
  new_count      INTEGER NOT NULL DEFAULT 0,
  error          TEXT,
  created_by     UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS prospect_searches_created_at_idx
  ON prospect_searches (created_at DESC);

-- Tabla puente, no una FK escalar en crm_contacts: un mismo comercio
-- cae en "bares en Córdoba" y en "restaurantes en Córdoba", y así se
-- puede reabrir el resultado de una búsqueda vieja.
CREATE TABLE IF NOT EXISTS prospect_search_results (
  search_id   UUID NOT NULL REFERENCES prospect_searches(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (search_id, contact_id)
);

CREATE INDEX IF NOT EXISTS prospect_search_results_contact_idx
  ON prospect_search_results (contact_id);

-- Contador de consultas a la API de búsqueda (nivel 3), por día.
-- Va en la base y no en memoria porque el worker es serverless: no hay
-- estado que sobreviva entre invocaciones.
CREATE TABLE IF NOT EXISTS prospect_api_usage (
  day          DATE PRIMARY KEY,
  cse_queries  INTEGER NOT NULL DEFAULT 0
);


-- ============================================================
-- 8. Merge de prospectos
-- ============================================================
-- Un upsert de PostgREST no alcanza: hay DOS claves únicas en juego
-- (phone y google_place_id) y ON CONFLICT solo puede inferir una. Si un
-- lugar scrapeado tiene el mismo teléfono que un contacto de WhatsApp
-- que ya existe, el upsert por google_place_id insertaría fila nueva y
-- reventaría con 23505 sobre phone.
CREATE OR REPLACE FUNCTION public.upsert_prospect(
  p_search_id  uuid,
  p_place_id   text,
  p_name       text,
  p_phone      text,
  p_wa_likely  boolean,
  p_address    text,
  p_website    text,
  p_maps_url   text,
  p_rating     numeric,
  p_reviews    integer,
  p_rubro      text,
  p_locality   text,
  -- En Argentina es muy común que el "sitio web" que publica un comercio en
  -- Google Maps sea en realidad su Instagram o su Facebook. Se clasifica antes
  -- de llamar acá (src/lib/prospects/urls.ts) y entra por el campo que
  -- corresponde, así el enriquecedor nunca intenta crawlear una red social.
  p_instagram  text DEFAULT NULL,
  p_facebook   text DEFAULT NULL,
  p_linkedin   text DEFAULT NULL
) RETURNS TABLE (contact_id uuid, was_new boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id  uuid;
  v_new boolean := false;
BEGIN
  -- Orden de matcheo: place_id (identidad fuerte) → teléfono.
  SELECT id INTO v_id FROM crm_contacts WHERE google_place_id = p_place_id;
  IF v_id IS NULL AND p_phone IS NOT NULL THEN
    SELECT id INTO v_id FROM crm_contacts WHERE phone = p_phone;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO crm_contacts (
      business_name, phone, whatsapp_likely, address, website,
      instagram_url, facebook_url, linkedin_url,
      google_place_id, google_maps_url, google_synced_at, rating,
      reviews_count, rubro, locality, origin, enrichment_status
    ) VALUES (
      p_name, p_phone, coalesce(p_wa_likely, false), p_address, p_website,
      p_instagram, p_facebook, p_linkedin,
      p_place_id, p_maps_url, NOW(), p_rating,
      p_reviews, p_rubro, p_locality, 'busqueda', 'pending'
    )
    ON CONFLICT DO NOTHING   -- sin target: cubre phone Y google_place_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      -- Carrera con otra corrida simultánea: la fila la insertó el otro.
      SELECT id INTO v_id FROM crm_contacts
       WHERE google_place_id = p_place_id
          OR (p_phone IS NOT NULL AND phone = p_phone)
       LIMIT 1;
    ELSE
      v_new := true;
    END IF;
  ELSE
    -- Nunca se pisa `origin` (el origen es el primero que conocimos y no
    -- se degrada) ni un dato ya cargado a mano (manual_lock).
    UPDATE crm_contacts SET
      business_name     = coalesce(business_name, p_name),
      phone             = coalesce(phone, p_phone),
      address           = coalesce(p_address, address),
      website           = coalesce(website, p_website),
      google_place_id   = coalesce(google_place_id, p_place_id),
      google_maps_url   = coalesce(p_maps_url, google_maps_url),
      google_synced_at  = NOW(),
      rating            = coalesce(p_rating, rating),
      reviews_count     = coalesce(p_reviews, reviews_count),
      rubro             = coalesce(rubro, p_rubro),
      locality          = coalesce(locality, p_locality),
      instagram_url     = coalesce(instagram_url, p_instagram),
      facebook_url      = coalesce(facebook_url, p_facebook),
      linkedin_url      = coalesce(linkedin_url, p_linkedin),
      whatsapp_likely   = whatsapp_likely OR coalesce(p_wa_likely, false),
      -- Si había quedado sin enriquecer y ahora hay algo nuevo que
      -- mirar, vuelve a la cola. (El WHERE de abajo ya excluye las
      -- fichas con manual_lock.)
      enrichment_status = CASE
        WHEN enrichment_status IN ('skipped', 'failed') THEN 'pending'
        ELSE enrichment_status END,
      updated_at        = NOW()
    WHERE id = v_id AND NOT manual_lock;

    -- Aun con manual_lock, la asociación con la búsqueda se registra.
    IF NOT FOUND THEN
      UPDATE crm_contacts SET google_synced_at = NOW() WHERE id = v_id;
    END IF;
  END IF;

  IF v_id IS NOT NULL AND p_search_id IS NOT NULL THEN
    INSERT INTO prospect_search_results (search_id, contact_id)
    VALUES (p_search_id, v_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_id, v_new;
END;
$$;

-- Envoltorio de lote: los 60 lugares de una búsqueda en UN round-trip.
-- 60 llamadas sueltas desde la Server Action serían 6-12 segundos de
-- latencia pura contra Supabase.
CREATE OR REPLACE FUNCTION public.upsert_prospects(p_search_id uuid, p_items jsonb)
RETURNS TABLE (total integer, created integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it jsonb;
  r  record;
  t  integer := 0;
  c  integer := 0;
BEGIN
  -- SECURITY DEFINER bypasea RLS, así que la función se controla el
  -- acceso ella misma. La Server Action ya hace requireAuth(), esto es
  -- la segunda barrera por si alguien llama la RPC directo.
  IF public.current_admin_role() IS NULL THEN
    RAISE EXCEPTION 'no autorizado';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO r FROM public.upsert_prospect(
      p_search_id,
      it->>'place_id',
      nullif(it->>'name', ''),
      nullif(it->>'phone', ''),
      coalesce((it->>'wa_likely')::boolean, false),
      nullif(it->>'address', ''),
      nullif(it->>'website', ''),
      nullif(it->>'maps_url', ''),
      (it->>'rating')::numeric,
      (it->>'reviews')::integer,
      nullif(it->>'rubro', ''),
      nullif(it->>'locality', ''),
      nullif(it->>'instagram', ''),
      nullif(it->>'facebook', ''),
      nullif(it->>'linkedin', '')
    );
    t := t + 1;
    IF r.was_new THEN c := c + 1; END IF;
  END LOOP;

  RETURN QUERY SELECT t, c;
END;
$$;


-- ============================================================
-- 9. Cola del enriquecedor
-- ============================================================
-- Reclamo atómico. Sin esto, dos corridas del cron solapadas (GitHub
-- Actions no garantiza el minuto, y un lote lento puede pasarse de 5)
-- visitarían los mismos sitios dos veces.
CREATE OR REPLACE FUNCTION public.claim_prospects_for_enrichment(p_limit integer)
RETURNS SETOF crm_contacts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE crm_contacts
     SET enrichment_status = 'running',
         last_scraped_at   = NOW()
   WHERE id IN (
     SELECT id FROM crm_contacts
      WHERE enrichment_status = 'pending'
        AND NOT manual_lock
        AND scrape_attempts < 3
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT GREATEST(coalesce(p_limit, 0), 0)
   )
  RETURNING *;
$$;

-- Watchdog: devuelve a la cola lo que quedó 'running' por un deploy a
-- mitad de lote, un timeout de la función o un OOM.
CREATE OR REPLACE FUNCTION public.requeue_stale_enrichments()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stale AS (
    UPDATE crm_contacts SET enrichment_status = 'pending'
     WHERE enrichment_status = 'running'
       AND last_scraped_at < NOW() - INTERVAL '15 minutes'
    RETURNING 1
  ) SELECT count(*)::integer FROM stale;
$$;

-- Contador diario de consultas del nivel 3, atómico.
CREATE OR REPLACE FUNCTION public.bump_cse_usage(p_limit integer)
RETURNS TABLE (used integer, allowed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_used integer;
BEGIN
  INSERT INTO prospect_api_usage (day, cse_queries)
  VALUES (CURRENT_DATE, 1)
  ON CONFLICT (day) DO UPDATE SET cse_queries = prospect_api_usage.cse_queries + 1
  RETURNING cse_queries INTO v_used;

  RETURN QUERY SELECT v_used, v_used <= p_limit;
END;
$$;


-- ============================================================
-- 10. Permisos de las funciones
-- ============================================================
REVOKE ALL ON FUNCTION public.upsert_prospect(uuid,text,text,text,boolean,text,text,text,numeric,integer,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_prospects(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_prospects_for_enrichment(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.requeue_stale_enrichments() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_cse_usage(integer) FROM PUBLIC;

-- upsert_prospects la llama la Server Action con la sesión del admin.
-- Las otras tres las llama el worker del cron con la service key.
GRANT EXECUTE ON FUNCTION public.upsert_prospects(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_prospects_for_enrichment(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.requeue_stale_enrichments() TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_cse_usage(integer) TO service_role;


-- ============================================================
-- 11. RLS de las tablas nuevas
-- ============================================================
-- crm_contacts ya tiene "Members can manage crm_contacts" FOR ALL (002):
-- las columnas nuevas quedan cubiertas sin tocar nada.
ALTER TABLE prospect_searches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_search_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_api_usage      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage prospect_searches" ON prospect_searches;
CREATE POLICY "Members can manage prospect_searches" ON prospect_searches FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

DROP POLICY IF EXISTS "Members can manage prospect_search_results" ON prospect_search_results;
CREATE POLICY "Members can manage prospect_search_results" ON prospect_search_results FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

-- Solo lectura desde la UI (para mostrar "Búsquedas de Google hoy:
-- 34/90"). Quien escribe es el worker con la service key, que bypasea
-- RLS: nadie debería poder falsear el contador desde el navegador.
DROP POLICY IF EXISTS "Members can read prospect_api_usage" ON prospect_api_usage;
CREATE POLICY "Members can read prospect_api_usage" ON prospect_api_usage FOR SELECT
  USING (public.current_admin_role() IS NOT NULL);


-- ============================================================
-- 12. Bug arrastrado: borrar mensajes del formulario no borraba nada
-- ============================================================
-- contact_messages nunca tuvo policy FOR DELETE. Con RLS activo, un
-- DELETE sin policy no da error: simplemente afecta 0 filas. Así que
-- deleteMessage() (admin/actions.ts) terminaba OK, la UI mostraba
-- éxito, y el mensaje seguía ahí.
DROP POLICY IF EXISTS "Auth delete messages" ON contact_messages;
CREATE POLICY "Auth delete messages" ON contact_messages FOR DELETE
  USING (auth.uid() IS NOT NULL);


-- ============================================================
-- 13. Fase 7 — el formulario web entra al CRM
-- ============================================================
-- Los leads viejos guardaron el teléfono CON '+' (inconsistente con
-- crm_contacts.phone, que son dígitos pelados). Se normaliza acá, a la
-- vez que api/contact/route.ts pasa a guardar sin '+'.
UPDATE contact_messages
   SET phone = regexp_replace(phone, '\D', '', 'g')
 WHERE phone IS NOT NULL
   AND phone <> regexp_replace(phone, '\D', '', 'g');

ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS contact_id UUID
  REFERENCES crm_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contact_messages_contact_id_idx
  ON contact_messages (contact_id);

-- (a) Leads con teléfono → clave phone.
INSERT INTO crm_contacts (phone, contact_name, business_name, email, origin, enrichment_status)
SELECT DISTINCT ON (m.phone)
       m.phone, m.name, nullif(m.company, ''), lower(m.email), 'formulario', 'skipped'
  FROM contact_messages m
 WHERE m.phone IS NOT NULL AND m.phone <> ''
 ORDER BY m.phone, m.created_at DESC
ON CONFLICT (phone) DO UPDATE SET
  email         = coalesce(crm_contacts.email,         EXCLUDED.email),
  contact_name  = coalesce(crm_contacts.contact_name,  EXCLUDED.contact_name),
  business_name = coalesce(crm_contacts.business_name, EXCLUDED.business_name);
  -- origin NO se pisa: si ese número ya escribió por WhatsApp, sigue
  -- siendo 'whatsapp' (el origen es el primero que conocimos).

-- (b) Leads sin teléfono → clave email. El NOT EXISTS lo hace
--     idempotente (no hay UNIQUE en email, ver nota del índice).
INSERT INTO crm_contacts (contact_name, business_name, email, origin, enrichment_status)
SELECT DISTINCT ON (lower(m.email))
       m.name, nullif(m.company, ''), lower(m.email), 'formulario', 'skipped'
  FROM contact_messages m
 WHERE (m.phone IS NULL OR m.phone = '')
   AND m.email IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM crm_contacts c WHERE c.email = lower(m.email))
 ORDER BY lower(m.email), m.created_at DESC;

-- (c) Enganchar cada mensaje con su ficha.
UPDATE contact_messages m
   SET contact_id = c.id
  FROM crm_contacts c
 WHERE m.contact_id IS NULL
   AND ( (m.phone IS NOT NULL AND m.phone <> '' AND c.phone = m.phone)
      OR ((m.phone IS NULL OR m.phone = '')     AND c.email = lower(m.email)) );


-- ============================================================
-- 14. Verificación — pegar el resultado de estas tres consultas
-- ============================================================
SELECT origin, contact_tier, count(*) AS clientes
  FROM crm_contacts
 GROUP BY 1, 2
 ORDER BY 1, 2;

SELECT count(*) AS mensajes_sin_ficha
  FROM contact_messages
 WHERE contact_id IS NULL;

SELECT count(*) FILTER (WHERE contact_name  IS NOT NULL) AS con_nombre_persona,
       count(*) FILTER (WHERE business_name IS NOT NULL) AS con_razon_social,
       count(*)                                          AS total
  FROM crm_contacts;
