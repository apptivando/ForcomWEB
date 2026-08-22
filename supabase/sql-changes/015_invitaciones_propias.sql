-- ============================================================
-- 015 — Invitaciones con token propio (22/08/2026)
-- ============================================================
--
-- POR QUÉ
-- Hasta ahora las invitaciones se mandaban con `auth.admin.inviteUserByEmail`
-- de Supabase: su mail, su diseño, en inglés, y con un token de un solo uso
-- que se consume con un GET. Los filtros de seguridad de las casillas
-- corporativas (Defender/Outlook y compañía) abren los links del correo antes
-- de entregarlo, así que quemaban el token y a la persona le llegaba una
-- invitación ya vencida. Pasó con emilio.reula@centroficina.com.ar el
-- 21/08/2026: el usuario quedó creado y con `last_sign_in_at` 24 segundos
-- después de la invitación, sin que nadie hubiera hecho clic.
--
-- QUÉ CAMBIA
-- El token lo emitimos nosotros y vive en esta tabla (guardado hasheado, no en
-- claro). Abrir el link solo muestra el formulario — no consume nada. El token
-- recién se usa cuando la persona manda la contraseña (POST), así que un
-- escáner que abra el link no rompe la invitación.
--
-- Correr en el SQL Editor de Supabase.

-- 1. Token propio de invitación
ALTER TABLE admin_invitations
  ADD COLUMN IF NOT EXISTS token_hash TEXT;

COMMENT ON COLUMN admin_invitations.token_hash IS
  'SHA-256 (hex) del token que viaja en el link de invitación. El token en claro solo existe en el mail: si se pierde, se reenvía la invitación y se genera uno nuevo. Se pone en NULL al aceptar (un solo uso).';

-- Un token no puede apuntar a dos invitaciones. NULL no cuenta para UNIQUE en
-- Postgres, así que las invitaciones ya aceptadas (token_hash = NULL) no
-- chocan entre sí.
CREATE UNIQUE INDEX IF NOT EXISTS admin_invitations_token_hash_idx
  ON admin_invitations (token_hash);

-- 2. Verificación
-- Las pendientes que quedaron del flujo viejo tienen token_hash NULL: no se
-- pueden aceptar y hay que reenviarlas desde /admin/miembros.
SELECT email, role, expires_at,
       (token_hash IS NOT NULL) AS tiene_token_nuevo
FROM admin_invitations
WHERE accepted_at IS NULL
ORDER BY created_at DESC;
