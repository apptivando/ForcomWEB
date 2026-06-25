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

CREATE POLICY IF NOT EXISTS "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY IF NOT EXISTS "Auth upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Auth delete product images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);
