-- ============================================================
-- 018 — Restaurar el INSERT público de contact_messages (26/08/2026)
-- ============================================================
--
-- POR QUÉ — ESTO ES UN BUG EN PRODUCCIÓN, NO UNA MEJORA
--
-- El formulario de contacto de forcom.tech NO PUEDE GUARDAR NADA. Un insert
-- con la clave anon devuelve:
--
--     42501: new row violates row-level security policy for table
--            "contact_messages"
--
-- O sea: RLS está activo y no hay ninguna policy de INSERT que habilite al rol
-- `anon`. La policy "Anyone can submit contact" está declarada en `schema.sql`
-- (línea 85) desde el principio, así que en algún momento se perdió en la base
-- —no por una migración de este repo: ninguna toca policies de esta tabla
-- salvo la 010, y esa solo agrega la de DELETE—.
--
-- CÓMO SE DETECTÓ
-- Probando el filtro anti-spam de la 017 de punta a punta contra
-- `POST /api/contact` en local. Los tres casos de bot devolvían `ok: true`
-- (correcto, se descartan en silencio) y el caso legítimo devolvía
-- "Error al guardar el mensaje". El insert directo con la clave anon confirmó
-- que era RLS y no el código.
--
-- CONSECUENCIA MIENTRAS ESTUVO ROTO
-- Cada consulta enviada desde el sitio se perdió: la persona vio el mensaje de
-- error del formulario y el lead nunca llegó al panel ni al correo de aviso
-- (el envío por Resend va después del insert y no se ejecuta si el insert
-- falla). El último mensaje guardado es del 21/08/2026.
--
-- Correr en el SQL Editor de Supabase, cuanto antes.

-- 1. Volver a habilitar el envío público del formulario
-- Es la única operación que el rol anon necesita sobre esta tabla: no puede
-- leer, ni actualizar, ni borrar. Solo dejar un mensaje.
DROP POLICY IF EXISTS "Anyone can submit contact" ON contact_messages;
CREATE POLICY "Anyone can submit contact" ON contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 2. Verificación
-- `insert_publico` tiene que dar 1. Las otras tres son las que ya existían y se
-- listan para confirmar que no se tocó nada más.
SELECT
  COUNT(*) FILTER (WHERE cmd = 'INSERT') AS insert_publico_debe_ser_1,
  COUNT(*) FILTER (WHERE cmd = 'SELECT') AS select_auth,
  COUNT(*) FILTER (WHERE cmd = 'UPDATE') AS update_auth,
  COUNT(*) FILTER (WHERE cmd = 'DELETE') AS delete_auth
FROM pg_policies
WHERE tablename = 'contact_messages';
