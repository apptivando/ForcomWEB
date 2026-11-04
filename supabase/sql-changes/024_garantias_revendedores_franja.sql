-- ============================================================
-- 024 — Garantías, revendedores, franja de datos y formulario del CRM (04/11/2026)
-- ============================================================
--
-- POR QUÉ
-- El panel de FORCOM se pone a la par del de Latin Office (repo
-- LatinOfficeWEB, mismo proyecto de Supabase, tablas `lo_*`). Esta migración
-- crea lo que en Latin Office ya existe, con las tablas de FORCOM sin prefijo:
--
--   1. warranties        → "Activar garantía" del sitio. 12 meses desde la
--                          factura, para todos los productos. Compra directa →
--                          activa sola; compra en un comercio → pendiente hasta
--                          que alguien valide la factura desde el panel.
--   2. reseller_requests → "Sumate como revendedor" del sitio.
--   3. facts             → franja de datos debajo del carrusel. Arranca VACÍA:
--                          mientras no tenga datos, el sitio no la muestra.
--   4. company_info      → `own_contact_form` (interruptor del formulario de
--                          contacto: false = el del CRM, true = el propio) y
--                          Facebook / Instagram.
--   5. Bucket privado `warranty-invoices` para las facturas.
--
-- El sitio tolera que esta migración no esté corrida: no muestra la franja,
-- muestra el formulario del CRM, y los formularios de garantía y revendedores
-- responden con un error amable. Igual conviene correrla ANTES del deploy.
--
-- PERMISOS (mismo criterio que la 023)
--   · warranties: anon no tiene nada. El alta la hace /api/garantia con la
--     service role (genera el código, sube la factura, valida el producto).
--     Los miembros de FORCOM leen, editan y borran.
--   · reseller_requests: anon solo INSERT, sin SELECT (/api/revendedores
--     inserta sin `.select()`, igual que /api/contact). Miembros gestionan.
--   · facts: lectura pública; miembros crean, editan y borran.
--   · "Miembro" = public.current_admin_role() IS NOT NULL (fila en
--     admin_members). Los miembros de Latin Office NO pasan.
--
-- Se puede correr más de una vez. Correr completo en el SQL Editor de Supabase.

BEGIN;

-- ============================================================
-- 1. Garantías
-- ============================================================

CREATE TABLE IF NOT EXISTS public.warranties (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL CHECK (status IN ('activa', 'pendiente', 'rechazada')),
  customer_name    TEXT NOT NULL,
  customer_doc     TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT NOT NULL,
  province         TEXT NOT NULL,
  city             TEXT NOT NULL,
  purchase_channel TEXT NOT NULL CHECK (purchase_channel IN ('directo', 'comercio')),
  store_name       TEXT,
  product_name     TEXT NOT NULL,
  product_id       UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity         INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  invoice_number   TEXT NOT NULL,
  invoice_date     DATE NOT NULL,
  expires_on       DATE NOT NULL,
  invoice_path     TEXT,
  admin_notes      TEXT,
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS warranties_status_idx ON public.warranties (status);
CREATE INDEX IF NOT EXISTS warranties_email_idx ON public.warranties (email);
COMMENT ON COLUMN public.warranties.status IS
  'activa (compra directa) | pendiente (compra en comercio, falta validar la factura) | rechazada.';
COMMENT ON COLUMN public.warranties.code IS 'FC-AAAA-XXXXXX. Lo genera /api/garantia.';
COMMENT ON COLUMN public.warranties.invoice_path IS 'Ruta dentro del bucket privado warranty-invoices.';

-- ============================================================
-- 2. Revendedores
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reseller_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  company        TEXT NOT NULL,
  province       TEXT NOT NULL,
  phone          TEXT NOT NULL,
  business_type  TEXT,
  message        TEXT,
  status         TEXT NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'contactado', 'alta', 'descartado', 'spam')),
  admin_notes    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reseller_requests_status_idx ON public.reseller_requests (status);
COMMENT ON COLUMN public.reseller_requests.phone IS 'Solo dígitos (E.164 sin +).';

-- ============================================================
-- 3. Franja de datos (vacía: el sitio no la muestra hasta que tenga datos)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.facts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  text         TEXT NOT NULL DEFAULT '',
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS facts_order_idx ON public.facts (order_index);

-- ============================================================
-- 4. company_info: interruptor del formulario y redes
-- ============================================================
-- Columnas nuevas de una tabla existente: heredan sus GRANT y policies (023).

ALTER TABLE public.company_info
  ADD COLUMN IF NOT EXISTS own_contact_form BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.company_info ADD COLUMN IF NOT EXISTS facebook TEXT;
ALTER TABLE public.company_info ADD COLUMN IF NOT EXISTS instagram TEXT;
COMMENT ON COLUMN public.company_info.own_contact_form IS
  'true = Contacto muestra el formulario propio (respaldo); false = el del CRM (crm.ventaweb.ar).';

-- ============================================================
-- 5. GRANT
-- ============================================================
-- "El GRANT habilita, RLS recorta": primero se saca todo, después se da lo justo.

REVOKE ALL ON public.warranties, public.reseller_requests, public.facts FROM anon, authenticated;
GRANT ALL ON public.warranties, public.reseller_requests, public.facts TO service_role;

GRANT SELECT, UPDATE, DELETE ON public.warranties TO authenticated;

GRANT INSERT ON public.reseller_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.reseller_requests TO authenticated;

GRANT SELECT ON public.facts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.facts TO authenticated;

-- ============================================================
-- 6. RLS
-- ============================================================

ALTER TABLE public.warranties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facts             ENABLE ROW LEVEL SECURITY;

-- Garantías: solo miembros (el alta va por service role, que saltea RLS).
DROP POLICY IF EXISTS "Members manage warranties" ON public.warranties;
CREATE POLICY "Members manage warranties" ON public.warranties
  FOR ALL TO authenticated
  USING ((SELECT public.current_admin_role()) IS NOT NULL)
  WITH CHECK ((SELECT public.current_admin_role()) IS NOT NULL);

-- Revendedores: cualquiera deja un pedido nuevo; el panel gestiona.
-- La policy pública no llama a la función: anon nunca la evalúa.
DROP POLICY IF EXISTS "Anyone can submit reseller" ON public.reseller_requests;
CREATE POLICY "Anyone can submit reseller" ON public.reseller_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'nuevo' AND admin_notes IS NULL);

DROP POLICY IF EXISTS "Members manage resellers" ON public.reseller_requests;
CREATE POLICY "Members manage resellers" ON public.reseller_requests
  FOR ALL TO authenticated
  USING ((SELECT public.current_admin_role()) IS NOT NULL)
  WITH CHECK ((SELECT public.current_admin_role()) IS NOT NULL);

-- Franja: lectura pública; el panel crea, edita y borra.
DROP POLICY IF EXISTS "Public read facts" ON public.facts;
CREATE POLICY "Public read facts" ON public.facts
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Members insert facts" ON public.facts;
CREATE POLICY "Members insert facts" ON public.facts
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_admin_role()) IS NOT NULL);

DROP POLICY IF EXISTS "Members update facts" ON public.facts;
CREATE POLICY "Members update facts" ON public.facts
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_admin_role()) IS NOT NULL)
  WITH CHECK ((SELECT public.current_admin_role()) IS NOT NULL);

DROP POLICY IF EXISTS "Members delete facts" ON public.facts;
CREATE POLICY "Members delete facts" ON public.facts
  FOR DELETE TO authenticated
  USING ((SELECT public.current_admin_role()) IS NOT NULL);

-- ============================================================
-- 7. Storage: facturas de garantía (bucket PRIVADO)
-- ============================================================
-- Sube el servidor con la service role. Los miembros la ven con un link
-- firmado que vence a los 10 minutos (getInvoiceUrl). 4 MB: Vercel corta los
-- pedidos de más de 4,5 MB antes de que lleguen a la ruta.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('warranty-invoices', 'warranty-invoices', false, 4194304,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Members read warranty-invoices" ON storage.objects;
CREATE POLICY "Members read warranty-invoices" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'warranty-invoices' AND (SELECT public.current_admin_role()) IS NOT NULL);

COMMIT;

-- ============================================================
-- 8. Verificación
-- ============================================================
-- Tiene que dar: tablas_debe_ser_3 = 3, bucket_privado = false,
-- own_contact_form = false, franja_vacia = 0.
SELECT
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('warranties', 'reseller_requests', 'facts')) AS tablas_debe_ser_3,
  (SELECT public FROM storage.buckets WHERE id = 'warranty-invoices') AS bucket_privado,
  (SELECT own_contact_form FROM public.company_info WHERE id = 1) AS own_contact_form,
  (SELECT COUNT(*) FROM public.facts) AS franja_vacia;
