-- ============================================================
-- 017 — Anti-spam del formulario web (26/08/2026)
-- ============================================================
--
-- POR QUÉ
-- El formulario público no tenía ninguna protección anti-bot. Entraron dos
-- envíos con razón social y nombre de contacto generados al azar —cadenas de
-- letras sin sentido— que no solo ensucian el contador de "mensajes nuevos"
-- del dashboard: se propagaron a `crm_contacts` y quedaron clasificados en la
-- prioridad "2 · Con email", o sea contaminaron la base de prospectos y
-- cualquier exportación a CSV.
--
-- Hasta ahora no había forma de marcarlos: solo borrar de a uno, expandiendo
-- cada mensaje, y después borrar el cliente en la otra sección.
--
-- QUÉ HACE
-- Agrega el estado 'spam' a `contact_messages`. Marcar un mensaje como spam es
-- distinto de borrarlo: el registro queda, así se puede revisar si el filtro se
-- comió algo legítimo, pero sale del contador de nuevos y de los listados
-- normales.
--
-- La defensa de entrada (honeypot + tiempo mínimo de llenado) vive en el
-- código, no en la base: `src/components/Contact.tsx` y
-- `src/app/api/contact/route.ts`.
--
-- Correr en el SQL Editor de Supabase.

-- 1. Estado 'spam' en los mensajes del formulario
ALTER TABLE contact_messages DROP CONSTRAINT IF EXISTS contact_messages_status_check;
ALTER TABLE contact_messages
  ADD CONSTRAINT contact_messages_status_check
  CHECK (status IN ('nuevo', 'leido', 'contactado', 'spam'));

COMMENT ON COLUMN contact_messages.status IS
  'nuevo | leido | contactado | spam. El spam no se borra: queda para poder revisar si el filtro se comió algo legítimo.';

-- Los listados del panel filtran por estado, y el dashboard cuenta los nuevos.
CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON contact_messages (status);

-- 2. Verificación
SELECT
  (SELECT COUNT(*) FROM contact_messages) AS mensajes,
  (SELECT COUNT(*) FROM contact_messages WHERE status = 'spam') AS marcados_spam,
  (SELECT pg_get_constraintdef(oid)
     FROM pg_constraint
    WHERE conname = 'contact_messages_status_check') AS check_debe_incluir_spam;
