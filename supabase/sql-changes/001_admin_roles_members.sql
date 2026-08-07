-- ============================================================
-- 001 — Roles y miembros del admin (01/08/2026)
-- Ya corrida — se deja acá para el historial. Ejecutar en Supabase
-- Dashboard > SQL Editor.
--
-- Fase 1 del Track E (CRM propio dentro de forcom-web) — reemplaza
-- "logueado = admin total" por roles reales, aplicado a TODO /admin,
-- no solo al futuro CRM. Referencia de diseño: src/lib/auth/account.ts
-- y roles.ts de wacrm (c:\Apptivando\wacrm), adaptado a un solo negocio
-- (sin tabla `accounts` — acá hay un solo FORCOM, no multi-cuenta).
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_members (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'agent')),
  full_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'agent')),
  invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_invitations_email_idx ON admin_invitations (email);

-- Devuelve el rol del usuario logueado, o NULL si no es miembro.
-- SECURITY DEFINER para poder leer admin_members desde una política RLS
-- de la propia tabla sin caer en recursión infinita.
CREATE OR REPLACE FUNCTION public.current_admin_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM admin_members WHERE user_id = auth.uid();
$$;

ALTER TABLE admin_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read all members" ON admin_members;
CREATE POLICY "Members can read all members" ON admin_members FOR SELECT
  USING (public.current_admin_role() IS NOT NULL);

DROP POLICY IF EXISTS "Owner/admin can manage members" ON admin_members;
CREATE POLICY "Owner/admin can manage members" ON admin_members FOR ALL
  USING (public.current_admin_role() IN ('owner', 'admin'))
  WITH CHECK (public.current_admin_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Owner/admin can manage invitations" ON admin_invitations;
CREATE POLICY "Owner/admin can manage invitations" ON admin_invitations FOR ALL
  USING (public.current_admin_role() IN ('owner', 'admin'))
  WITH CHECK (public.current_admin_role() IN ('owner', 'admin'));

-- Bootstrap: cualquier usuario que ya existía en auth.users antes de
-- que existieran los roles (es decir, quien ya usaba el admin) pasa a
-- ser 'owner' automáticamente. Sin esto nadie podría invitar a nadie
-- (la política de arriba exige ya ser owner/admin para escribir).
INSERT INTO admin_members (user_id, role)
SELECT id, 'owner' FROM auth.users
WHERE id NOT IN (SELECT user_id FROM admin_members)
ON CONFLICT (user_id) DO NOTHING;
