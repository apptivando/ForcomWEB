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
  phone       TEXT NOT NULL UNIQUE,  -- E.164 con 9, ej. 5493511234567 (ver normalizeArgentinePhone en api/contact/route.ts)
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
