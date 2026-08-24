-- ============================================================
-- 016 — Recuperación de contraseña (24/08/2026)
-- ============================================================
--
-- POR QUÉ
-- Hasta ahora, quien se olvidaba la contraseña del panel no tenía salida
-- propia: había que pedirle a un admin que lo invitara de nuevo. Esta tabla
-- sostiene el "olvidé mi contraseña" de /admin/recuperar.
--
-- MISMO MECANISMO QUE LAS INVITACIONES (ver 015): el token lo emite la app,
-- acá va solo su hash, y abrir el link no consume nada — se marca usado recién
-- cuando llega la contraseña nueva por POST. Así los antivirus de las casillas
-- corporativas, que abren los links antes de entregar el correo, no queman el
-- link de recuperación.
--
-- Correr en el SQL Editor de Supabase.

-- 1. Pedidos de recuperación de contraseña
CREATE TABLE IF NOT EXISTS admin_password_resets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE admin_password_resets IS
  'Links de recuperación de contraseña del panel. Duran una hora y son de un solo uso.';
COMMENT ON COLUMN admin_password_resets.token_hash IS
  'SHA-256 (hex) del token del link. El token en claro solo existe en el correo.';

CREATE UNIQUE INDEX IF NOT EXISTS admin_password_resets_token_hash_idx
  ON admin_password_resets (token_hash);
CREATE INDEX IF NOT EXISTS admin_password_resets_email_idx
  ON admin_password_resets (email);

-- 2. RLS: cerrada del todo, a propósito
-- Sin políticas, ni anon ni authenticated pueden tocar nada. La tabla la usa
-- únicamente el servidor con la service role key (que saltea RLS), porque quien
-- pide una recuperación justamente NO tiene sesión. Es distinto de
-- admin_invitations, que sí se lee desde el panel con la sesión de un admin.
ALTER TABLE admin_password_resets ENABLE ROW LEVEL SECURITY;

-- 3. Verificación
SELECT
  (SELECT COUNT(*) FROM admin_password_resets) AS pedidos,
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'admin_password_resets') AS rls_activa,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'admin_password_resets') AS politicas_debe_ser_0;
