-- ============================================================
-- 020 — Darle ficha de cliente a los leads que entraron por producción
--       (24/09/2026)
-- ============================================================
--
-- QUÉ PASA
--
-- Un lead que entra por el formulario de forcom.tech queda guardado en
-- `contact_messages` pero SIN ficha en `crm_contacts`: `contact_id` vacío y
-- ninguna fila del lado de Clientes. En el panel se ve el mensaje y no se ve el
-- cliente.
--
-- POR QUÉ, Y POR QUÉ NO ES UN BUG
--
-- Crear la ficha es la fase 7 del Track E, y esa fase vive solo en `develop`.
-- Producción corre `main`, que guarda el mensaje y nada más. Los dos paneles
-- —forcom.tech/admin y dev.forcom.tech/admin— leen la MISMA base, así que el de
-- dev muestra el mensaje que entró por producción y, al abrir Clientes, no
-- encuentra una ficha que nadie creó.
--
-- O sea: no hay nada roto. Falta código en producción, no permisos ni datos.
-- Cuando `develop` llegue a `main`, cada lead nuevo se va a enganchar solo y
-- esta migración deja de hacer falta.
--
-- MIENTRAS TANTO
--
-- Esto es el mismo backfill de la migración 010 (secciones (a), (b) y (c)),
-- recortado y **pensado para correrse las veces que haga falta**: cada vez que
-- entre un lead por producción antes del merge. No duplica nada —el upsert por
-- teléfono y el NOT EXISTS por email se encargan— y no pisa datos: donde la
-- ficha ya tiene algo cargado, lo deja como está.
--
-- Correr en el SQL Editor de Supabase.

-- 1. Backfill

-- (a) Leads con teléfono → la clave es el teléfono, que es lo que comparten con
--     el CRM de WhatsApp.
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
  -- `origin` NO se pisa: si ese número ya escribió por WhatsApp o vino del
  -- scraper, sigue figurando con el origen que conocimos primero.

-- (b) Leads sin teléfono → la clave es el email. No hay UNIQUE sobre esa
--     columna (las cadenas comparten info@… entre sucursales), así que el
--     NOT EXISTS es lo que lo hace repetible.
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

-- (d) El teléfono que la persona escribió en el campo rotulado WhatsApp cuenta
--     como confirmado — es el criterio de la migración 019, repetido acá porque
--     un lead nuevo entra por (a) sin pasar por ese backfill. Solo donde está
--     vacío: un WhatsApp confirmado por otra vía puede ser otro número.
UPDATE crm_contacts c
SET    whatsapp_phone = c.phone,
       whatsapp_source = 'formulario',
       updated_at = NOW()
WHERE  c.whatsapp_phone IS NULL
  AND  c.phone IS NOT NULL
  AND  EXISTS (
         SELECT 1 FROM contact_messages m
         WHERE  m.contact_id = c.id
           AND  m.phone IS NOT NULL
       );

-- 2. Verificación
-- `sin_ficha` tiene que dar 0. Si da otra cosa, hay un mensaje cuyo email es
-- NULL (imposible desde el formulario, la ruta lo valida) o algo cambió.
SELECT
  COUNT(*)                                        AS mensajes,
  COUNT(*) FILTER (WHERE contact_id IS NOT NULL)  AS con_ficha,
  COUNT(*) FILTER (WHERE contact_id IS NULL)      AS sin_ficha
FROM contact_messages;
