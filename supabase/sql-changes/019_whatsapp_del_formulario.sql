-- ============================================================
-- 019 — El WhatsApp que deja la persona en el formulario cuenta como
--       confirmado (26/08/2026)
-- ============================================================
--
-- QUÉ PASABA
--
-- El formulario del sitio pide "Teléfono (WhatsApp) — opcional" y aclara
-- abajo: "Si lo dejás, te podemos contactar directo por WhatsApp". Ese número
-- se guardaba SOLO en `crm_contacts.phone`, nunca en `whatsapp_phone`.
--
-- Resultado: en Mensajes del formulario el botón "Responder por WhatsApp"
-- aparecía (usa `contact_messages.phone`), pero al abrir la ficha del mismo
-- cliente el chip de WhatsApp estaba apagado, la fila WhatsApp decía "—" y el
-- botón "Abrir en la Bandeja" no existía. Dos pantallas contradiciéndose sobre
-- el mismo dato.
--
-- POR QUÉ ES CONFIRMADO Y NO "PARECE UN CELULAR"
--
-- `whatsapp_phone` es, por diseño, evidencia real: un enlace wa.me en el sitio,
-- un número junto a la palabra WhatsApp, un resultado de búsqueda. Nunca se
-- completa por el solo hecho de que el número tenga pinta de celular — para eso
-- está `whatsapp_likely`.
--
-- Un número que la propia persona escribió en un campo rotulado WhatsApp,
-- sabiendo que le vamos a escribir por ahí, es la evidencia MÁS fuerte de
-- todas: no la dedujo un scraper, la declaró el dueño del número.
--
-- Por eso entra un valor nuevo en el origen, `formulario`, en vez de reusar
-- `manual` (que significa "lo cargó alguien del equipo a mano" y perdería de
-- vista que el dato lo dio el cliente).
--
-- EFECTO LATERAL BUSCADO: `contact_tier` es una columna generada
-- (whatsapp_phone → prioridad 1). Estos leads pasan de prioridad 3 a 1, que es
-- justo lo que corresponde: es alguien que pidió que lo contacten.

-- 1. El origen nuevo
ALTER TABLE crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_whatsapp_source_check;
ALTER TABLE crm_contacts ADD CONSTRAINT crm_contacts_whatsapp_source_check
  CHECK (whatsapp_source IS NULL OR whatsapp_source IN ('link', 'texto', 'busqueda', 'manual', 'formulario'));

-- 2. Backfill de los leads que ya entraron por el formulario
--
-- El criterio no es `origin = 'formulario'`: un prospecto que ya existía por
-- Google Maps y después completó el formulario conserva su origen original
-- (así lo hace el upsert de /api/contact) y también dio su número. Lo que
-- define el caso es tener un mensaje del formulario CON teléfono.
--
-- Se compara contra `crm_contacts.phone` para no pisar nada: si la ficha ya
-- tiene un WhatsApp confirmado por otra vía, el WHERE la deja afuera.
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
