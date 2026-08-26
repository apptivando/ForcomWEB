-- ============================================================
-- FORCOM Web — Schema + Seed
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Hero content (fila única)
CREATE TABLE IF NOT EXISTS hero_content (
  id INTEGER PRIMARY KEY DEFAULT 1,
  badge_text TEXT NOT NULL DEFAULT 'Soluciones POS & Retail Tech',
  headline_line1 TEXT NOT NULL DEFAULT 'Tecnología',
  headline_line2 TEXT NOT NULL DEFAULT 'que entiende',
  headline_red TEXT NOT NULL DEFAULT 'su negocio',
  subheadline TEXT NOT NULL DEFAULT 'Hardware de grado empresarial para punto de venta, logística y retail. Terminales inteligentes, impresoras de alta velocidad y soluciones de escaneo que transforman su operación.',
  cta_primary TEXT NOT NULL DEFAULT 'Ver productos',
  cta_secondary TEXT NOT NULL DEFAULT 'Contactar ventas',
  trust_item_1 TEXT NOT NULL DEFAULT 'Soporte técnico local',
  trust_item_2 TEXT NOT NULL DEFAULT 'Garantía directa',
  trust_item_3 TEXT NOT NULL DEFAULT 'Envío a todo el país',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hero_content ADD CONSTRAINT single_row_check CHECK (id = 1);

INSERT INTO hero_content (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Imagen del hero (opcional — se muestra en lugar del placeholder CSS)
ALTER TABLE hero_content ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

-- Productos
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model TEXT NOT NULL,
  category TEXT NOT NULL,
  section TEXT NOT NULL,
  section_id TEXT NOT NULL,
  badge TEXT,
  image_url TEXT,
  specs TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mensajes de contacto (CRM)
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT NOT NULL,
  industry TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'leido', 'contactado')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Migración: teléfono opcional (30/07/2026) — usado para crear la
-- conversación de WhatsApp en el CRM cuando el lead lo deja cargado.
-- Ejecutar en Supabase Dashboard > SQL Editor si la tabla ya existe.
-- ============================================================
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS phone TEXT;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE hero_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Hero: lectura pública, escritura solo autenticados
CREATE POLICY "Public read hero" ON hero_content FOR SELECT USING (true);
CREATE POLICY "Auth update hero" ON hero_content FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Products: lectura pública (solo activos), CRUD solo autenticados
CREATE POLICY "Public read active products" ON products FOR SELECT USING (active = true OR auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert products" ON products FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update products" ON products FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete products" ON products FOR DELETE USING (auth.uid() IS NOT NULL);

-- Contact messages: inserción pública (formulario), gestión solo autenticados
CREATE POLICY "Anyone can submit contact" ON contact_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth read messages" ON contact_messages FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update messages" ON contact_messages FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Seed productos (15 productos del catálogo FORCOM)
-- ============================================================

INSERT INTO products (model, category, section, section_id, badge, image_url, specs, order_index) VALUES
('A6 G2 Smart-POS', 'Terminal Flagship', 'Smart POS — Terminales Inteligentes', 'cat-smart-pos', 'PREMIUM', '/images/products/forcom-a6.png', ARRAY['Pantalla táctil capacitiva 18.5"', 'Chasis de aluminio, Intel Core i7', '16GB RAM · 256GB SSD', 'WiFi dual-band · Ideal para restaurantes y retail'], 1),
('T5 Smart-POS', 'Terminal Versátil', 'Smart POS — Terminales Inteligentes', 'cat-smart-pos', NULL, '/images/products/forcom-t5.png', ARRAY['Pantalla táctil capacitiva 15"', 'ABS + metal, Intel Core i5', '8GB RAM · 256GB SSD', 'Supermercados, restaurantes, estaciones de servicio'], 2),
('N100 Mini PC', 'PC Ultra-compacta', 'Mini PC — Computación Compacta', 'cat-mini-pc', NULL, '/images/products/forcom-n100-mini-pc.png', ARRAY['Intel Alder Lake N100', '8GB DDR4 (expandible a 32GB) · 256GB M.2', 'Triple salida video: DP + HDMI + Type-C', 'Dual LAN 2.5G · VESA mount incluido'], 3),
('TK-200', 'Impresora Térmica', 'Impresoras — Térmica & Etiquetas', 'cat-impresoras', NULL, '/images/products/forcom-tk200.png', ARRAY['230mm/s · Papel 80mm', 'USB + Ethernet · ESC/POS', 'Auto-cutter · Compacta', 'Ideal para checkouts rápidos'], 4),
('TK-300', 'Impresora Heavy-Duty', 'Impresoras — Térmica & Etiquetas', 'cat-impresoras', 'ALTO VOLUMEN', '/images/products/forcom-tk300.png', ARRAY['300mm/s · Papel 80mm', 'USB + LAN · 150km vida útil cabezal', '1.5M cortes · Alta resistencia', 'Para operaciones de alto volumen'], 5),
('EasyLabel', 'Impresora de Etiquetas', 'Impresoras — Térmica & Etiquetas', 'cat-impresoras', NULL, '/images/products/forcom-easylabel.png', ARRAY['Térmica directa + transferencia', '127mm/s · Ancho 108mm', 'TSPL / EPL / ZPL / DPL', 'Retail, logística, ecommerce'], 6),
('FORCOM 898', 'Lector Omnidireccional', 'Lectores de Escritorio', 'cat-lectores', NULL, '/images/products/forcom-898.png', ARRAY['1D + 2D · CMOS SXGA-W', 'Hasta 3.8m/s · USB plug & play', 'Diseño elegante negro/plata', 'Lectura omnidireccional'], 7),
('FORCOM 888', 'Lector Gran Angular', 'Lectores de Escritorio', 'cat-lectores', NULL, '/images/products/forcom-888.png', ARRAY['1D + 2D · 3.8m/s', 'IP54 · Hands-free', 'Escaneo de ángulo amplio', 'Omnidireccional'], 8),
('FORCOM 7088', 'Multi-código Simultáneo', 'Lectores de Escritorio', 'cat-lectores', 'FARMACIAS', '/images/products/forcom-7088.png', ARRAY['Lectura multi-código simultánea', '120 FPS · Alta velocidad', 'Ideal para farmacias', 'Compatible apps facturación IVA'], 9),
('FORCOM 9088', 'Lector Auto-sensing', 'Lectores de Escritorio', 'cat-lectores', NULL, '/images/products/forcom-9088.png', ARRAY['Auto-sensing · 4m/s', 'USB / RS232', 'Montable o standalone', 'Versatilidad total'], 10),
('FORCOM 8066', 'Wireless Premium', 'Lectores de Mano', 'cat-lectores-mano', '100m ALCANCE', '/images/products/forcom-8066.png', ARRAY['Bluetooth + 2.4G · 100m alcance', '1D + 2D · 120 FPS · 2200mAh', '7h autonomía · 200K chars offline', 'Lee QR de Mercado Pago, WeChat, Alipay'], 11),
('FORCOM 2162', 'Handheld USB', 'Lectores de Mano', 'cat-lectores-mano', NULL, NULL, ARRAY['USB · 1D + 2D', 'Ergonómico y liviano', 'Lee QR desde pantallas digitales', 'Plug & play'], 12),
('FORCOM 2150BT USB', 'Industrial Grade', 'Lectores de Mano', 'cat-lectores-mano', 'IP54', NULL, ARRAY['USB · Grado industrial', 'IP54 · Resistente a caídas 3m', 'Robusto para campo', 'Máxima durabilidad'], 13),
('FORCOM VX4 Windows', 'Kiosco Autoservicio', 'Verificadores de Precio', 'cat-verificadores', NULL, '/images/products/forcom-vx4-windows.png', ARRAY['Pantalla táctil 11.6" capacitiva', 'Intel Core i3 · 4GB RAM · 128GB SSD', 'Lector 1D/2D integrado', 'Windows 10 · Verificación de precios'], 14),
('FORCOM VX4 Android', 'Kiosco Android', 'Verificadores de Precio', 'cat-verificadores', NULL, '/images/products/forcom-vx4-android.png', ARRAY['Pantalla táctil 11.6" capacitiva', 'RK3566 · 2GB RAM · 32GB eMMC', 'Android 11 · Lector integrado', 'Con o sin app preinstalada'], 15),
('FORCOM 5D Cash Drawer', 'Cajón de Dinero', 'Accesorios', 'cat-accesorios', NULL, NULL, ARRAY['Acero sólido reforzado', '5 billetes + 8 monedas', 'Conector RJ11 · Solenoide 24V', 'Cerradura 3 posiciones'], 16),
('FORCOM VEO Customer Display', 'Visor de Cliente', 'Accesorios', 'cat-accesorios', NULL, '/images/products/forcom-veo-display.png', ARRAY['TFT-LCD · Múltiples resoluciones', '800×480 a 1024×768 · USB', 'Driver Windows incluido', 'Muestra precios y promociones'], 17),
('RLS1100', 'Balanza de Comercio', 'Balanzas', 'cat-balanzas', NULL, '/images/products/forcom-rls1100.png', ARRAY['— Completar specs desde catálogo pág. 9-10 —', '— Completar specs desde catálogo pág. 9-10 —', '— Completar specs desde catálogo pág. 9-10 —', '— Completar specs desde catálogo pág. 9-10 —'], 18);

-- ============================================================
-- Migración: campos para modal de especificaciones
-- Ejecutar en Supabase Dashboard > SQL Editor si la tabla ya existe
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS images      TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS videos      TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS full_specs  TEXT,
  ADD COLUMN IF NOT EXISTS files       JSONB   DEFAULT '[]';

-- ============================================================
-- Supabase Storage: bucket para imágenes de productos
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Auth upload product images" ON storage.objects;
CREATE POLICY "Auth upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth delete product images" ON storage.objects;
CREATE POLICY "Auth delete product images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

-- ============================================================
-- Migración: slug para páginas de producto individuales (URL propia)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE products SET slug = lower(
  regexp_replace(regexp_replace(trim(model), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
) WHERE slug IS NULL;

ALTER TABLE products ALTER COLUMN slug SET NOT NULL;
ALTER TABLE products ADD CONSTRAINT products_slug_unique UNIQUE (slug);

-- ============================================================
-- Migración: roles y miembros del admin (01/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
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

-- ============================================================
-- Migración: CRM propio — contactos, conversaciones, mensajes (01/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Fase 2 del Track E — reemplaza a wacrm. Conectado a WhatsApp vía
-- Evolution API (self-hosted), no directo a Meta. Prefijo `crm_` para
-- no confundir con `contact_messages` (el buzón viejo del formulario
-- de contacto, que sigue existiendo aparte como log de auditoría).
--
-- Un solo negocio (FORCOM), sin multi-cuenta — a diferencia de wacrm,
-- no hace falta `account_id` en ningún lado. `assigned_member_id` /
-- `sender_member_id` referencian a `admin_members` (fase 1 de este
-- mismo track), no a una tabla de cuentas.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL UNIQUE,  -- E.164 sin '+', ej. 5493511234567 (ver src/lib/phone.ts). La migración 010 lo hace nullable.
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_conversations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id             UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  status                 TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  last_message_text      TEXT,
  last_message_at        TIMESTAMPTZ,
  ai_autoreply_disabled  BOOLEAN NOT NULL DEFAULT false,
  assigned_member_id     UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_conversations_contact_id_idx ON crm_conversations (contact_id);

CREATE TABLE IF NOT EXISTS crm_messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    UUID NOT NULL REFERENCES crm_conversations(id) ON DELETE CASCADE,
  direction          TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  content_type       TEXT NOT NULL DEFAULT 'text',
  content_text       TEXT,
  media_url          TEXT,
  wa_message_id      TEXT UNIQUE,  -- idempotencia: Evolution puede reintentar el webhook
  ai_generated       BOOLEAN NOT NULL DEFAULT false,
  sender_member_id   UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,  -- null si es del cliente o de la IA
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_messages_conversation_id_idx ON crm_messages (conversation_id);

CREATE OR REPLACE FUNCTION public.touch_crm_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS crm_conversations_updated_at ON crm_conversations;
CREATE TRIGGER crm_conversations_updated_at
  BEFORE UPDATE ON crm_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_crm_conversation_updated_at();

ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_messages ENABLE ROW LEVEL SECURITY;

-- Cualquier miembro del admin (cualquier rol) puede leer y operar el
-- CRM — a diferencia de admin_members, donde solo admin/owner
-- gestionan gente. El webhook y el envío de mensajes corren con la
-- service role (bypasea RLS), así que estas políticas son para la UI.
DROP POLICY IF EXISTS "Members can manage crm_contacts" ON crm_contacts;
CREATE POLICY "Members can manage crm_contacts" ON crm_contacts FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

DROP POLICY IF EXISTS "Members can manage crm_conversations" ON crm_conversations;
CREATE POLICY "Members can manage crm_conversations" ON crm_conversations FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

DROP POLICY IF EXISTS "Members can manage crm_messages" ON crm_messages;
CREATE POLICY "Members can manage crm_messages" ON crm_messages FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

-- ============================================================
-- Migración: respuestas rápidas (12/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Fase 3 del Track E (cierre) — ver supabase/sql-changes/003_quick_replies.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS quick_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_by  UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage quick_replies" ON quick_replies;
CREATE POLICY "Members can manage quick_replies" ON quick_replies FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

-- ============================================================
-- Migración: asistente de IA + base de conocimiento (12/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Fase 4 del Track E — ver supabase/sql-changes/004_ai_agent.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_ts_config WHERE cfgname = 'spanish_unaccent'
  ) THEN
    CREATE TEXT SEARCH CONFIGURATION public.spanish_unaccent (COPY = pg_catalog.spanish);
  END IF;
END $$;

ALTER TEXT SEARCH CONFIGURATION public.spanish_unaccent
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;

CREATE TABLE IF NOT EXISTS ai_config (
  id                          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider                    TEXT NOT NULL DEFAULT 'anthropic' CHECK (provider IN ('anthropic', 'openai')),
  model                       TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  api_key_encrypted           TEXT,
  system_prompt               TEXT NOT NULL DEFAULT '',
  auto_reply_enabled          BOOLEAN NOT NULL DEFAULT false,
  max_replies_per_conversation INTEGER NOT NULL DEFAULT 3,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ai_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can manage ai_config" ON ai_config;
CREATE POLICY "Members can manage ai_config" ON ai_config FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

CREATE TABLE IF NOT EXISTS ai_knowledge_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_by  UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_knowledge_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can manage ai_knowledge_documents" ON ai_knowledge_documents;
CREATE POLICY "Members can manage ai_knowledge_documents" ON ai_knowledge_documents FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES ai_knowledge_documents(id) ON DELETE CASCADE,
  chunk_index  INTEGER NOT NULL DEFAULT 0,
  content      TEXT NOT NULL,
  fts          tsvector GENERATED ALWAYS AS (to_tsvector('public.spanish_unaccent', content)) STORED,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_document_id_idx ON ai_knowledge_chunks (document_id);
CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_fts_idx ON ai_knowledge_chunks USING gin (fts);

ALTER TABLE ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can manage ai_knowledge_chunks" ON ai_knowledge_chunks;
CREATE POLICY "Members can manage ai_knowledge_chunks" ON ai_knowledge_chunks FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

-- NOTA: la versión de abajo ya incluye el fix de 005 (OR en vez de AND
-- entre palabras) — ver supabase/sql-changes/005_fix_knowledge_search_or.sql.
CREATE OR REPLACE FUNCTION public.match_ai_knowledge_fts(
  p_query       text,
  p_match_count integer
)
RETURNS TABLE (id uuid, content text, rank real) AS $$
  SELECT c.id,
         c.content,
         ts_rank(c.fts, q.query) AS rank
  FROM ai_knowledge_chunks c,
       (SELECT regexp_replace(
          plainto_tsquery('public.spanish_unaccent', p_query)::text,
          ' & ', ' | ', 'g'
        )::tsquery AS query) q
  WHERE c.fts @@ q.query
  ORDER BY rank DESC
  LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.match_ai_knowledge_fts(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_fts(text, integer) TO authenticated, service_role;

ALTER TABLE crm_conversations ADD COLUMN IF NOT EXISTS ai_reply_count INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- Migración: el asistente de IA busca en el catálogo de productos (12/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Ver supabase/sql-changes/006_ai_products_search.sql
-- ============================================================

-- Sin columna generada ni índice: Postgres no acepta una expresión que
-- combina varias columnas + array_to_string como "immutable" (ver
-- nota en 006_ai_products_search.sql). Con 18 productos alcanza con
-- calcular el tsvector al vuelo dentro de la función.
CREATE OR REPLACE FUNCTION public.match_products_fts(
  p_query       text,
  p_match_count integer
)
RETURNS TABLE (id uuid, content text, rank real) AS $$
  SELECT p.id,
         'Producto: ' || p.model ||
           coalesce(' (' || p.category || ')', '') || E'\n' ||
           coalesce(p.description || E'\n', '') ||
           coalesce(array_to_string(p.specs, E'\n'), '') AS content,
         ts_rank(
           to_tsvector(
             'public.spanish_unaccent',
             coalesce(p.model, '') || ' ' ||
             coalesce(p.category, '') || ' ' ||
             coalesce(p.description, '') || ' ' ||
             coalesce(p.full_specs, '') || ' ' ||
             coalesce(array_to_string(p.specs, ' '), '')
           ),
           q.query
         ) AS rank
  FROM products p,
       (SELECT regexp_replace(
          plainto_tsquery('public.spanish_unaccent', p_query)::text,
          ' & ', ' | ', 'g'
        )::tsquery AS query) q
  WHERE p.active = true
    AND to_tsvector(
          'public.spanish_unaccent',
          coalesce(p.model, '') || ' ' ||
          coalesce(p.category, '') || ' ' ||
          coalesce(p.description, '') || ' ' ||
          coalesce(p.full_specs, '') || ' ' ||
          coalesce(array_to_string(p.specs, ' '), '')
        ) @@ q.query
  ORDER BY rank DESC
  LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.match_products_fts(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_products_fts(text, integer) TO authenticated, service_role;

-- ============================================================
-- Migración: pipelines de venta (12/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Fase 5 del Track E — ver supabase/sql-changes/007_pipelines.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pipeline_stages (name, order_index)
SELECT * FROM (VALUES
  ('Nuevo', 0),
  ('Contactado', 1),
  ('Cotizado', 2),
  ('Negociación', 3),
  ('Ganado', 4),
  ('Perdido', 5)
) AS defaults(name, order_index)
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages);

CREATE TABLE IF NOT EXISTS pipeline_deals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id          UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  stage_id            UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  title               TEXT NOT NULL,
  value               NUMERIC,
  notes               TEXT,
  assigned_member_id  UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pipeline_deals_stage_id_idx ON pipeline_deals (stage_id);
CREATE INDEX IF NOT EXISTS pipeline_deals_contact_id_idx ON pipeline_deals (contact_id);

CREATE OR REPLACE FUNCTION public.touch_pipeline_deal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pipeline_deals_updated_at ON pipeline_deals;
CREATE TRIGGER pipeline_deals_updated_at
  BEFORE UPDATE ON pipeline_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_pipeline_deal_updated_at();

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage pipeline_stages" ON pipeline_stages;
CREATE POLICY "Members can manage pipeline_stages" ON pipeline_stages FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

DROP POLICY IF EXISTS "Members can manage pipeline_deals" ON pipeline_deals;
CREATE POLICY "Members can manage pipeline_deals" ON pipeline_deals FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

-- ============================================================
-- Migración: automatizaciones (12/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Fase 6 del Track E — ver supabase/sql-changes/008_automations.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS automations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  trigger_type      TEXT NOT NULL CHECK (trigger_type IN ('keyword_match', 'new_conversation')),
  trigger_keywords  TEXT[],
  active            BOOLEAN NOT NULL DEFAULT true,
  created_by        UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_steps (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id      UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  step_index         INTEGER NOT NULL,
  action_type        TEXT NOT NULL CHECK (action_type IN ('send_message', 'wait', 'assign_agent')),
  message_text       TEXT,
  wait_minutes       INTEGER,
  assign_member_id   UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (automation_id, step_index)
);

CREATE TABLE IF NOT EXISTS automation_pending_executions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id     UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  conversation_id   UUID NOT NULL REFERENCES crm_conversations(id) ON DELETE CASCADE,
  next_step_index   INTEGER NOT NULL,
  run_at            TIMESTAMPTZ NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_pending_executions_due_idx
  ON automation_pending_executions (status, run_at);

CREATE TABLE IF NOT EXISTS automation_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id     UUID REFERENCES automations(id) ON DELETE SET NULL,
  conversation_id   UUID REFERENCES crm_conversations(id) ON DELETE SET NULL,
  step_index        INTEGER,
  action_type       TEXT,
  status            TEXT NOT NULL CHECK (status IN ('success', 'error')),
  detail            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_logs_automation_id_idx ON automation_logs (automation_id);

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_pending_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage automations" ON automations;
CREATE POLICY "Members can manage automations" ON automations FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

DROP POLICY IF EXISTS "Members can manage automation_steps" ON automation_steps;
CREATE POLICY "Members can manage automation_steps" ON automation_steps FOR ALL
  USING (public.current_admin_role() IS NOT NULL)
  WITH CHECK (public.current_admin_role() IS NOT NULL);

DROP POLICY IF EXISTS "Members can read automation_pending_executions" ON automation_pending_executions;
CREATE POLICY "Members can read automation_pending_executions" ON automation_pending_executions FOR SELECT
  USING (public.current_admin_role() IS NOT NULL);

DROP POLICY IF EXISTS "Members can read automation_logs" ON automation_logs;
CREATE POLICY "Members can read automation_logs" ON automation_logs FOR SELECT
  USING (public.current_admin_role() IS NOT NULL);

-- ============================================================
-- Migración: búsqueda semántica del asistente (13/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Ver supabase/sql-changes/009_ai_semantic_search.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS embeddings_api_key_encrypted TEXT;

ALTER TABLE ai_knowledge_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_embedding_idx
  ON ai_knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_ai_knowledge_semantic(
  p_query_embedding text,
  p_match_count     integer
)
RETURNS TABLE (id uuid, content text, distance real) AS $$
  SELECT c.id,
         c.content,
         (c.embedding <=> p_query_embedding::vector) AS distance
  FROM ai_knowledge_chunks c
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding <=> p_query_embedding::vector
  LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.match_ai_knowledge_semantic(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_semantic(text, integer) TO authenticated, service_role;


-- ============================================================
-- Migración: clientes unificados + prospección (19/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Ver supabase/sql-changes/010_clientes_unificados.sql
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
-- Migración: contacto en frío (20/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Ver supabase/sql-changes/011_contacto_en_frio.sql
-- ============================================================

-- ============================================================
-- 1. Plantillas de contacto inicial
-- ============================================================
-- Separadas de `quick_replies` a propósito, aunque se parezcan: una
-- respuesta rápida es texto que un agente inserta DENTRO de una
-- conversación abierta (no necesita aprobación de nadie), y una
-- plantilla es un mensaje que INICIA la conversación y que Meta tiene
-- que aprobar antes. Distinto ciclo de vida, distintos permisos,
-- distinta tabla.
CREATE TABLE IF NOT EXISTS outreach_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  -- Nombre exacto de la plantilla en Meta (minúsculas y guiones bajos).
  -- Nulo mientras se trabaja con Evolution.
  meta_template_name  TEXT,
  language            TEXT NOT NULL DEFAULT 'es_AR',
  -- Categorías de Meta. 'marketing' es la que aplica a prospección en
  -- frío; 'utility' es para avisos de algo que el cliente ya pidió.
  category            TEXT NOT NULL DEFAULT 'marketing'
                      CHECK (category IN ('marketing', 'utility', 'authentication')),
  -- borrador → se está escribiendo · enviada → esperando a Meta
  -- aprobada → se puede usar · rechazada → Meta la bajó
  status              TEXT NOT NULL DEFAULT 'borrador'
                      CHECK (status IN ('borrador', 'enviada', 'aprobada', 'rechazada')),
  rejection_reason    TEXT,
  -- El cuerpo usa marcadores {{1}}, {{2}}… igual que Meta.
  body                TEXT NOT NULL,
  -- Qué representa cada marcador, en orden. Ej: ["razón social", "rubro"].
  -- Sirve para completarlos solos desde la ficha del cliente.
  variables           JSONB NOT NULL DEFAULT '[]'::jsonb,
  active              BOOLEAN NOT NULL DEFAULT true,
  created_by          UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS outreach_templates_active_idx
  ON outreach_templates (active, status);

CREATE OR REPLACE FUNCTION public.touch_outreach_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS outreach_templates_updated_at ON outreach_templates;
CREATE TRIGGER outreach_templates_updated_at
  BEFORE UPDATE ON outreach_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_outreach_template_updated_at();

-- Una plantilla de ejemplo, en borrador, para que la pantalla no arranque
-- vacía y se vea cómo se usan los marcadores.
INSERT INTO outreach_templates (name, body, variables, category, status)
SELECT
  'Presentación FORCOM',
  E'Hola{{1}}, te escribo de FORCOM, fabricante argentino de equipamiento para punto de venta.\n\nVimos que trabajan en {{2}} y quería contarte que fabricamos los equipos acá, con repuestos y garantía directa.\n\n¿Te interesa que te pase información?',
  '["nombre de contacto", "rubro"]'::jsonb,
  'marketing',
  'borrador'
WHERE NOT EXISTS (SELECT 1 FROM outreach_templates);


-- ============================================================
-- 2. Trazabilidad del contacto en frío
-- ============================================================
-- Sin esto no se puede saber a quién ya se le escribió, y se terminaría
-- insistiéndole al mismo prospecto en cada tanda.
ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS outreach_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outreach_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS crm_contacts_outreach_idx
  ON crm_contacts (outreach_at DESC NULLS LAST);


-- ============================================================
-- 3. Tope diario de mensajes en frío
-- ============================================================
-- El contador ya existe para las consultas de búsqueda; se le agrega una
-- columna en vez de crear otra tabla. Va en la base y no en memoria
-- porque el server es serverless: no hay estado entre pedidos.
ALTER TABLE prospect_api_usage
  ADD COLUMN IF NOT EXISTS cold_messages INTEGER NOT NULL DEFAULT 0;

COMMENT ON TABLE prospect_api_usage IS
  'Contadores diarios con tope: consultas a la API de búsqueda y mensajes en frío.';

-- Reserva un cupo de mensaje en frío, de forma atómica. Se llama ANTES
-- de mandar: si devuelve allowed=false no hay que enviar nada.
--
-- El incremento ocurre igual cuando no está permitido, y es a propósito:
-- así dos pedidos simultáneos no pueden colarse los dos por el mismo
-- último cupo. El costo es que un rechazo "gasta" un número del contador,
-- lo cual no importa porque el contador solo existe para frenar.
CREATE OR REPLACE FUNCTION public.reserve_cold_message(p_limit integer)
RETURNS TABLE (used integer, allowed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_used integer;
BEGIN
  INSERT INTO prospect_api_usage (day, cold_messages)
  VALUES (CURRENT_DATE, 1)
  ON CONFLICT (day) DO UPDATE SET cold_messages = prospect_api_usage.cold_messages + 1
  RETURNING cold_messages INTO v_used;

  RETURN QUERY SELECT v_used, v_used <= p_limit;
END;
$$;

-- Devuelve el cupo si el envío falló, para no castigar al operador por un
-- error de red o de Evolution.
CREATE OR REPLACE FUNCTION public.release_cold_message()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE prospect_api_usage
     SET cold_messages = GREATEST(cold_messages - 1, 0)
   WHERE day = CURRENT_DATE;
$$;

REVOKE ALL ON FUNCTION public.reserve_cold_message(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_cold_message() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_cold_message(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_cold_message() TO authenticated, service_role;


-- ============================================================
-- 4. Marca de mensajes en frío en el historial
-- ============================================================
-- Un mensaje saliente puede ser una respuesta dentro de una conversación
-- o el primer contacto en frío. Distinguirlos permite medir después qué
-- porcentaje contesta, y saber con qué plantilla se abrió cada charla.
ALTER TABLE crm_messages
  ADD COLUMN IF NOT EXISTS is_outreach BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES outreach_templates(id) ON DELETE SET NULL;


-- ============================================================
-- 5. RLS
-- ============================================================
ALTER TABLE outreach_templates ENABLE ROW LEVEL SECURITY;

-- Leer: cualquier miembro (un agente necesita elegir plantilla para enviar).
DROP POLICY IF EXISTS "Members can read outreach_templates" ON outreach_templates;
CREATE POLICY "Members can read outreach_templates" ON outreach_templates FOR SELECT
  USING (public.current_admin_role() IS NOT NULL);

-- Escribir: solo owner/admin. Una plantilla aprobada por Meta es un
-- compromiso de la empresa; que un agente pueda editarle el texto a una
-- plantilla ya aprobada sería una forma silenciosa de saltearse la
-- aprobación.
DROP POLICY IF EXISTS "Owner/admin can manage outreach_templates" ON outreach_templates;
CREATE POLICY "Owner/admin can manage outreach_templates" ON outreach_templates FOR ALL
  USING (public.current_admin_role() IN ('owner', 'admin'))
  WITH CHECK (public.current_admin_role() IN ('owner', 'admin'));


-- ============================================================
-- Migración: ficha de cliente y línea de tiempo (20/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Ver supabase/sql-changes/012_ficha_cliente.sql
-- ============================================================

-- ============================================================
-- 1. La tabla
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id       UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN (
                     'note',          -- la escribe una persona; editable
                     'deal_created',  -- de acá para abajo: sistema, inmutable
                     'deal_moved',
                     'deal_updated',
                     'deal_deleted',
                     'edited'         -- alguien cambió datos de la ficha
                   )),
  body             TEXT,
  -- Datos estructurados del evento. Los nombres de etapa se guardan COPIADOS
  -- acá y no por id: si mañana renombran "Cotizado", la historia tiene que
  -- seguir diciendo lo que pasó ese día.
  meta             JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_member_id  UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Una nota vacía no es una nota.
  CONSTRAINT crm_events_note_has_body
    CHECK (kind <> 'note' OR btrim(coalesce(body, '')) <> '')
);

-- El único acceso que existe: los eventos de UN contacto, del más nuevo al más
-- viejo. Compuesto para que paginar por cursor sea recorrer el índice y no
-- ordenar en memoria.
CREATE INDEX IF NOT EXISTS crm_events_contact_created_idx
  ON crm_events (contact_id, created_at DESC);

-- El mismo tratamiento para los mensajes: hoy solo hay índice por
-- conversation_id, así que traer los últimos 40 de un contacto con 500
-- mensajes ordena 500 filas en memoria cada vez.
CREATE INDEX IF NOT EXISTS crm_messages_conversation_created_idx
  ON crm_messages (conversation_id, created_at DESC);


-- ============================================================
-- 2. Lo que no se puede cambiar de una nota
-- ============================================================
-- RLS controla QUIÉN edita, no QUÉ columnas. Sin esto, el autor de una nota
-- podría reasignársela a otro miembro en el mismo UPDATE con el que corrige un
-- error de tipeo.
CREATE OR REPLACE FUNCTION public.freeze_crm_event_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.id              := OLD.id;
  NEW.contact_id      := OLD.contact_id;
  NEW.kind            := OLD.kind;
  NEW.actor_member_id := OLD.actor_member_id;
  NEW.created_at      := OLD.created_at;
  NEW.updated_at      := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_events_freeze_identity ON crm_events;
CREATE TRIGGER crm_events_freeze_identity
  BEFORE UPDATE ON crm_events
  FOR EACH ROW
  EXECUTE FUNCTION public.freeze_crm_event_identity();


-- ============================================================
-- 3. Los movimientos del Pipeline se registran solos
-- ============================================================
-- Va como trigger y no como escritura desde la Server Action por una sola
-- razón: si es explícito, se puede olvidar. Hoy ya hay dos caminos que mueven
-- una oportunidad (la Server Action y el SQL Editor) y mañana puede haber un
-- tercero. Un historial con agujeros es peor que no tener historial, porque se
-- le cree.
--
-- El costo está en la rama del DELETE. Leer ese comentario antes de tocar nada.
CREATE OR REPLACE FUNCTION public.log_pipeline_deal_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_from  text;
  v_to    text;
BEGIN
  -- auth.uid() vale dentro del trigger cuando la escritura entra por PostgREST
  -- con el JWT del usuario. Cuando entra con la service key (un script, el
  -- worker) es NULL, y está bien: el evento queda como "del sistema". El
  -- SELECT contra admin_members evita que un uid que no sea miembro haga
  -- fallar la clave foránea y aborte el movimiento.
  SELECT user_id INTO v_actor FROM admin_members WHERE user_id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    SELECT name INTO v_to FROM pipeline_stages WHERE id = NEW.stage_id;
    INSERT INTO crm_events (contact_id, kind, body, meta, actor_member_id)
    VALUES (NEW.contact_id, 'deal_created', NEW.title,
            jsonb_build_object('deal_id', NEW.id, 'stage', v_to, 'value', NEW.value),
            v_actor);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
      SELECT name INTO v_from FROM pipeline_stages WHERE id = OLD.stage_id;
      SELECT name INTO v_to   FROM pipeline_stages WHERE id = NEW.stage_id;
      INSERT INTO crm_events (contact_id, kind, body, meta, actor_member_id)
      VALUES (NEW.contact_id, 'deal_moved', NEW.title,
              jsonb_build_object('deal_id', NEW.id, 'from', v_from, 'to', v_to),
              v_actor);
    ELSIF (NEW.title, NEW.value, NEW.notes) IS DISTINCT FROM (OLD.title, OLD.value, OLD.notes) THEN
      INSERT INTO crm_events (contact_id, kind, body, meta, actor_member_id)
      VALUES (NEW.contact_id, 'deal_updated', NEW.title,
              jsonb_build_object('deal_id', NEW.id,
                                 'value_from', OLD.value, 'value_to', NEW.value),
              v_actor);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- OJO: pipeline_deals tiene ON DELETE CASCADE desde crm_contacts. Cuando
    -- se borra un cliente, Postgres borra primero la fila padre y después
    -- cascadea a las hijas — así que acá el contacto YA NO EXISTE, y un INSERT
    -- en crm_events referenciándolo reventaría con violación de clave foránea
    -- y abortaría el DELETE entero: deleteClient() dejaría de funcionar, con
    -- un error que no le apunta a nadie al trigger.
    --
    -- Este IF EXISTS es lo único que lo evita. NO SACARLO por parecer
    -- redundante.
    IF EXISTS (SELECT 1 FROM crm_contacts WHERE id = OLD.contact_id) THEN
      INSERT INTO crm_events (contact_id, kind, body, meta, actor_member_id)
      VALUES (OLD.contact_id, 'deal_deleted', OLD.title,
              jsonb_build_object('deal_id', OLD.id), v_actor);
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS pipeline_deals_log_events ON pipeline_deals;
CREATE TRIGGER pipeline_deals_log_events
  AFTER INSERT OR UPDATE OR DELETE ON pipeline_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_pipeline_deal_event();


-- ============================================================
-- 4. La línea de tiempo, en una sola consulta
-- ============================================================
-- Cuatro fuentes (eventos, WhatsApp, formulario web, de qué búsqueda salió)
-- normalizadas a la misma forma y ordenadas juntas.
--
-- POR QUÉ ACÁ Y NO EN JS
-- Mezclando en JS habría que traer las cuatro listas con un tope cada una y
-- ordenarlas. Funciona para la primera página y se rompe en la segunda: un
-- cliente con 500 mensajes de WhatsApp tapa el mensaje del formulario de hace
-- un año, porque el tope de la fuente de WhatsApp se agota antes de llegar —
-- y ese mensaje viejo suele ser justo el dato valioso. Acá el orden es global.
--
-- SIN SECURITY DEFINER a propósito: así el RLS de cada tabla de origen sigue
-- aplicando tal cual y esta función no reimplementa ningún control de acceso.
--
-- Paginación por cursor (p_before) y no por OFFSET: con OFFSET, un mensaje que
-- entra mientras se pagina corre todo un lugar y repite una fila.
CREATE OR REPLACE FUNCTION public.contact_timeline(
  p_contact_id uuid,
  p_before     timestamptz DEFAULT NULL,
  p_limit      integer     DEFAULT 40
)
RETURNS TABLE (
  source   text,
  ref_id   uuid,
  kind     text,
  at       timestamptz,
  body     text,
  meta     jsonb,
  actor_id uuid
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH cutoff AS (SELECT coalesce(p_before, 'infinity'::timestamptz) AS ts)
  SELECT * FROM (
    SELECT 'event'::text, e.id, e.kind, e.created_at, e.body, e.meta, e.actor_member_id
      FROM crm_events e, cutoff
     WHERE e.contact_id = p_contact_id AND e.created_at < cutoff.ts

    UNION ALL

    SELECT 'wa'::text, m.id,
           CASE WHEN m.direction = 'in' THEN 'wa_in' ELSE 'wa_out' END,
           m.created_at,
           coalesce(m.content_text, '[' || m.content_type || ']'),
           jsonb_build_object('conversation_id', m.conversation_id,
                              'is_outreach',     m.is_outreach,
                              'ai',              m.ai_generated,
                              'media_url',       m.media_url),
           m.sender_member_id
      FROM crm_messages m
      JOIN crm_conversations c ON c.id = m.conversation_id, cutoff
     WHERE c.contact_id = p_contact_id AND m.created_at < cutoff.ts

    UNION ALL

    SELECT 'form'::text, f.id, 'form_message', f.created_at, f.message,
           jsonb_build_object('name', f.name, 'email', f.email,
                              'industry', f.industry, 'status', f.status),
           NULL::uuid
      FROM contact_messages f, cutoff
     WHERE f.contact_id = p_contact_id AND f.created_at < cutoff.ts

    UNION ALL

    SELECT 'search'::text, s.id, 'from_search', r.created_at,
           s.rubro || ' · ' || s.locality,
           jsonb_build_object('search_id', s.id, 'rubro', s.rubro, 'locality', s.locality),
           s.created_by
      FROM prospect_search_results r
      JOIN prospect_searches s ON s.id = r.search_id, cutoff
     WHERE r.contact_id = p_contact_id AND r.created_at < cutoff.ts
  ) t(source, ref_id, kind, at, body, meta, actor_id)
  ORDER BY at DESC
  LIMIT greatest(coalesce(p_limit, 40), 1);
$$;

REVOKE ALL ON FUNCTION public.contact_timeline(uuid, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contact_timeline(uuid, timestamptz, integer)
  TO authenticated, service_role;


-- ============================================================
-- 5. RLS
-- ============================================================
ALTER TABLE crm_events ENABLE ROW LEVEL SECURITY;

-- Leer: cualquier miembro, como el resto del CRM.
DROP POLICY IF EXISTS "Members can read crm_events" ON crm_events;
CREATE POLICY "Members can read crm_events" ON crm_events FOR SELECT
  USING (public.current_admin_role() IS NOT NULL);

-- Escribir: SOLO notas, y SOLO a nombre propio. Un evento de sistema no se
-- puede fabricar desde el navegador. Los que escribe el trigger entran igual
-- porque SECURITY DEFINER bypasea RLS.
DROP POLICY IF EXISTS "Members can add own notes" ON crm_events;
CREATE POLICY "Members can add own notes" ON crm_events FOR INSERT
  WITH CHECK (
    public.current_admin_role() IS NOT NULL
    AND kind = 'note'
    AND actor_member_id = auth.uid()
  );

-- Editar y borrar: solo notas, solo el autor o un owner/admin. Un agente no
-- debería poder retocar la nota que escribió otro.
DROP POLICY IF EXISTS "Author or admin can edit notes" ON crm_events;
CREATE POLICY "Author or admin can edit notes" ON crm_events FOR UPDATE
  USING (kind = 'note'
         AND (actor_member_id = auth.uid()
              OR public.current_admin_role() IN ('owner', 'admin')))
  WITH CHECK (kind = 'note');

DROP POLICY IF EXISTS "Author or admin can delete notes" ON crm_events;
CREATE POLICY "Author or admin can delete notes" ON crm_events FOR DELETE
  USING (kind = 'note'
         AND (actor_member_id = auth.uid()
              OR public.current_admin_role() IN ('owner', 'admin')));

-- Supabase ya otorga estos permisos por default a las tablas nuevas del schema
-- public; van explícitos por si ese default cambia.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE crm_events TO authenticated;
GRANT ALL ON TABLE crm_events TO service_role;


-- ============================================================
-- 6. Las notas viejas pasan a ser notas de verdad
-- ============================================================
-- `crm_contacts.notes` es hoy un solo campo de texto compartido entre una
-- persona y una máquina: el enriquecedor le concatena sus propios hallazgos
-- (src/lib/prospects/enrich.ts). Por eso tocar una nota tenía que congelar la
-- ficha — no había forma de distinguir quién había escrito qué.
--
-- Se migra solo lo que escribió una persona: las fichas con manual_lock. Lo
-- que hay en las demás lo puso el enriquecedor y sigue donde está, como su
-- bloc de notas.
INSERT INTO crm_events (contact_id, kind, body, meta, created_at)
SELECT c.id, 'note', c.notes,
       '{"migrada_desde":"crm_contacts.notes"}'::jsonb,
       coalesce(c.updated_at, c.created_at)
  FROM crm_contacts c
 WHERE c.manual_lock
   AND btrim(coalesce(c.notes, '')) <> ''
   AND NOT EXISTS (
     SELECT 1 FROM crm_events e
      WHERE e.contact_id = c.id
        AND e.meta ->> 'migrada_desde' = 'crm_contacts.notes'
   );

COMMENT ON COLUMN crm_contacts.notes IS
  'Bloc del enriquecedor automático. Las notas de una persona van en crm_events (kind=note).';


-- ============================================================
-- Migración: líneas de WhatsApp (20/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Ver supabase/sql-changes/013_lineas_whatsapp.sql
-- ============================================================

-- ============================================================
-- 1. Las líneas
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  -- 'meta' se atiende desde la Bandeja; 'baileys' solo registra.
  kind          TEXT NOT NULL DEFAULT 'baileys' CHECK (kind IN ('meta', 'baileys')),
  -- Nombre de la instancia en Evolution. Null para las de Meta, que no pasan
  -- por Evolution. Es la clave por la que el webhook resuelve a qué línea
  -- pertenece cada evento.
  instance      TEXT UNIQUE,
  -- El número de la línea, en dígitos sin '+'. Informativo.
  phone         TEXT,
  -- De qué vendedor es. Null para la oficial, que es de la empresa.
  member_id     UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  -- Último estado que reportó Evolution: open | close | connecting.
  conn_state    TEXT,
  conn_checked_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  -- La línea principal, a la que se asignan las conversaciones que se abren
  -- desde la plataforma. Solo puede haber una.
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS wa_lines_one_primary_idx
  ON wa_lines (is_primary) WHERE is_primary;

CREATE INDEX IF NOT EXISTS wa_lines_member_idx ON wa_lines (member_id);

CREATE OR REPLACE FUNCTION public.touch_wa_line_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wa_lines_updated_at ON wa_lines;
CREATE TRIGGER wa_lines_updated_at
  BEFORE UPDATE ON wa_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_wa_line_updated_at();


-- ============================================================
-- 2. Cada conversación sabe de qué línea vino
-- ============================================================
-- Sin esto, la misma empresa hablando con el mismo cliente desde dos líneas
-- distintas sería una sola conversación revuelta, y la Bandeja no podría
-- distinguir lo que le toca atender de lo que solo se registra.
ALTER TABLE crm_conversations
  ADD COLUMN IF NOT EXISTS line_id UUID REFERENCES wa_lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS crm_conversations_line_idx ON crm_conversations (line_id);

-- Un contacto tiene una conversación abierta POR LÍNEA. Sin esto, dos
-- vendedores hablando con el mismo cliente compartirían hilo, y los mensajes
-- de uno aparecerían mezclados con los del otro.
--
-- Antes de poner el índice hay que cerrar los duplicados que pudieran existir:
-- si quedara alguno, el CREATE UNIQUE INDEX falla y aborta la migración
-- entera. Se conserva la más reciente de cada par.
UPDATE crm_conversations c
   SET status = 'closed'
 WHERE c.status = 'open'
   AND EXISTS (
     SELECT 1 FROM crm_conversations o
      WHERE o.contact_id = c.contact_id
        AND o.status = 'open'
        AND o.line_id IS NOT DISTINCT FROM c.line_id
        AND (o.last_message_at, o.created_at, o.id) > (c.last_message_at, c.created_at, c.id)
   );

DROP INDEX IF EXISTS crm_conversations_contact_line_open_idx;
CREATE UNIQUE INDEX crm_conversations_contact_line_open_idx
  ON crm_conversations (contact_id, line_id)
  WHERE status = 'open';


-- ============================================================
-- 3. La línea oficial y el backfill
-- ============================================================
-- Se crea la línea principal y se le asignan todas las conversaciones que ya
-- existen: hasta hoy todas venían del número de la empresa.
--
-- `instance` queda en NULL a propósito. El webhook la completa solo la primera
-- vez que llega un mensaje cuya instancia coincide con EVOLUTION_INSTANCE —
-- así no hay que escribir acá un valor que solo conoce el entorno, y la
-- migración no puede quedar desincronizada con la variable.
INSERT INTO wa_lines (name, kind, is_primary, active)
SELECT 'Centroficina (línea oficial)', 'meta', true, true
WHERE NOT EXISTS (SELECT 1 FROM wa_lines WHERE is_primary);

UPDATE crm_conversations
   SET line_id = (SELECT id FROM wa_lines WHERE is_primary LIMIT 1)
 WHERE line_id IS NULL;


-- ============================================================
-- 4. Un origen más: los clientes que aparecen por un vendedor
-- ============================================================
ALTER TABLE crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_origin_check;
ALTER TABLE crm_contacts ADD CONSTRAINT crm_contacts_origin_check
  CHECK (origin IN ('busqueda', 'whatsapp', 'formulario', 'manual', 'vendedor'));


-- ============================================================
-- 5. Números excluidos por ser personales
-- ============================================================
-- Conectar la línea de un vendedor registra TODAS sus conversaciones de ese
-- número, no solo las de trabajo. El análisis marca las de tono personal y
-- desde la pantalla se excluye el número y se borra lo ya guardado.
--
-- Tabla aparte y no una columna en `crm_contacts` porque la exclusión tiene
-- que **sobrevivir al borrado del contacto**: si fuera una columna, se iría
-- con la purga y el próximo mensaje volvería a crear la ficha.
CREATE TABLE IF NOT EXISTS wa_excluded_numbers (
  phone       TEXT PRIMARY KEY,
  reason      TEXT,
  excluded_by UUID REFERENCES admin_members(user_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/**
 * Excluye un número y borra todo rastro suyo.
 *
 * Borrar y no solo "dejar de registrar de acá en adelante": lo que se guardó
 * antes de detectar que la conversación era personal sigue siendo una
 * conversación personal guardada. El CASCADE de `crm_contacts` se lleva
 * conversaciones, mensajes y eventos.
 */
CREATE OR REPLACE FUNCTION public.exclude_and_purge_number(
  p_phone  text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (contacts_deleted integer, messages_deleted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor    uuid;
  v_contacts integer := 0;
  v_messages integer := 0;
BEGIN
  IF public.current_admin_role() NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'solo owner o admin pueden excluir un número';
  END IF;

  SELECT user_id INTO v_actor FROM admin_members WHERE user_id = auth.uid();

  INSERT INTO wa_excluded_numbers (phone, reason, excluded_by)
  VALUES (p_phone, p_reason, v_actor)
  ON CONFLICT (phone) DO UPDATE SET reason = excluded.reason;

  SELECT count(*)::integer INTO v_messages
    FROM crm_messages m
    JOIN crm_conversations c ON c.id = m.conversation_id
    JOIN crm_contacts k ON k.id = c.contact_id
   WHERE k.phone = p_phone;

  WITH gone AS (DELETE FROM crm_contacts WHERE phone = p_phone RETURNING 1)
  SELECT count(*)::integer INTO v_contacts FROM gone;

  RETURN QUERY SELECT v_contacts, v_messages;
END;
$$;

REVOKE ALL ON FUNCTION public.exclude_and_purge_number(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exclude_and_purge_number(text, text) TO authenticated;


-- ============================================================
-- 6. RLS
-- ============================================================
ALTER TABLE wa_lines            ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_excluded_numbers ENABLE ROW LEVEL SECURITY;

-- Leer las líneas: cualquier miembro (la Bandeja necesita saber de cuál vino
-- cada conversación).
DROP POLICY IF EXISTS "Members can read wa_lines" ON wa_lines;
CREATE POLICY "Members can read wa_lines" ON wa_lines FOR SELECT
  USING (public.current_admin_role() IS NOT NULL);

-- Administrarlas: solo owner/admin. Conectar una línea es vincular un
-- dispositivo al WhatsApp de una persona; no es una acción de todos los días.
DROP POLICY IF EXISTS "Owner/admin can manage wa_lines" ON wa_lines;
CREATE POLICY "Owner/admin can manage wa_lines" ON wa_lines FOR ALL
  USING (public.current_admin_role() IN ('owner', 'admin'))
  WITH CHECK (public.current_admin_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Owner/admin can manage exclusions" ON wa_excluded_numbers;
CREATE POLICY "Owner/admin can manage exclusions" ON wa_excluded_numbers FOR ALL
  USING (public.current_admin_role() IN ('owner', 'admin'))
  WITH CHECK (public.current_admin_role() IN ('owner', 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wa_lines TO authenticated;
GRANT ALL ON TABLE wa_lines TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wa_excluded_numbers TO authenticated;
GRANT ALL ON TABLE wa_excluded_numbers TO service_role;


-- ============================================================
-- 7. La línea de tiempo del cliente muestra de qué línea vino cada mensaje
-- ============================================================
-- Se recrea `contact_timeline` sumando el nombre de la línea al `meta` de cada
-- mensaje de WhatsApp. Sin esto, en la ficha no se distinguiría lo que habló
-- un vendedor de lo que salió por la línea oficial.
CREATE OR REPLACE FUNCTION public.contact_timeline(
  p_contact_id uuid,
  p_before     timestamptz DEFAULT NULL,
  p_limit      integer     DEFAULT 40
)
RETURNS TABLE (
  source   text,
  ref_id   uuid,
  kind     text,
  at       timestamptz,
  body     text,
  meta     jsonb,
  actor_id uuid
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH cutoff AS (SELECT coalesce(p_before, 'infinity'::timestamptz) AS ts)
  SELECT * FROM (
    SELECT 'event'::text, e.id, e.kind, e.created_at, e.body, e.meta, e.actor_member_id
      FROM crm_events e, cutoff
     WHERE e.contact_id = p_contact_id AND e.created_at < cutoff.ts

    UNION ALL

    SELECT 'wa'::text, m.id,
           CASE WHEN m.direction = 'in' THEN 'wa_in' ELSE 'wa_out' END,
           m.created_at,
           coalesce(m.content_text, '[' || m.content_type || ']'),
           jsonb_build_object('conversation_id', m.conversation_id,
                              'is_outreach',     m.is_outreach,
                              'ai',              m.ai_generated,
                              'media_url',       m.media_url,
                              'line',            l.name,
                              'line_kind',       l.kind),
           m.sender_member_id
      FROM crm_messages m
      JOIN crm_conversations c ON c.id = m.conversation_id
      LEFT JOIN wa_lines l ON l.id = c.line_id, cutoff
     WHERE c.contact_id = p_contact_id AND m.created_at < cutoff.ts

    UNION ALL

    SELECT 'form'::text, f.id, 'form_message', f.created_at, f.message,
           jsonb_build_object('name', f.name, 'email', f.email,
                              'industry', f.industry, 'status', f.status),
           NULL::uuid
      FROM contact_messages f, cutoff
     WHERE f.contact_id = p_contact_id AND f.created_at < cutoff.ts

    UNION ALL

    SELECT 'search'::text, s.id, 'from_search', r.created_at,
           s.rubro || ' · ' || s.locality,
           jsonb_build_object('search_id', s.id, 'rubro', s.rubro, 'locality', s.locality),
           s.created_by
      FROM prospect_search_results r
      JOIN prospect_searches s ON s.id = r.search_id, cutoff
     WHERE r.contact_id = p_contact_id AND r.created_at < cutoff.ts
  ) t(source, ref_id, kind, at, body, meta, actor_id)
  ORDER BY at DESC
  LIMIT greatest(coalesce(p_limit, 40), 1);
$$;

REVOKE ALL ON FUNCTION public.contact_timeline(uuid, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contact_timeline(uuid, timestamptz, integer)
  TO authenticated, service_role;


-- ============================================================
-- Migración: análisis de conversaciones de vendedores (20/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Ver supabase/sql-changes/014_analisis_conversaciones.sql
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
-- Migración: invitaciones con token propio (22/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Ver supabase/sql-changes/015_invitaciones_propias.sql
-- ============================================================


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


-- ============================================================
-- Migración: recuperación de contraseña (24/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Ver supabase/sql-changes/016_recuperar_contrasena.sql
-- ============================================================


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


-- ============================================================
-- Migración: anti-spam del formulario web (26/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Ver supabase/sql-changes/017_antispam.sql
-- ============================================================


-- 1. Estado 'spam' en los mensajes del formulario
ALTER TABLE contact_messages DROP CONSTRAINT IF EXISTS contact_messages_status_check;
ALTER TABLE contact_messages
  ADD CONSTRAINT contact_messages_status_check
  CHECK (status IN ('nuevo', 'leido', 'contactado', 'spam'));

COMMENT ON COLUMN contact_messages.status IS
  'nuevo | leido | contactado | spam. El spam no se borra: queda para poder revisar si el filtro se comió algo legítimo.';

-- Los listados del panel filtran por estado, y el dashboard cuenta los nuevos.
CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON contact_messages (status);


-- ============================================================
-- Migración: restaurar el INSERT público del formulario (26/08/2026)
-- Ejecutar en Supabase Dashboard > SQL Editor
-- Ver supabase/sql-changes/018_fix_rls_formulario.sql
-- ============================================================


-- 1. Volver a habilitar el envío público del formulario
-- Es la única operación que el rol anon necesita sobre esta tabla: no puede
-- leer, ni actualizar, ni borrar. Solo dejar un mensaje.
DROP POLICY IF EXISTS "Anyone can submit contact" ON contact_messages;
CREATE POLICY "Anyone can submit contact" ON contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
