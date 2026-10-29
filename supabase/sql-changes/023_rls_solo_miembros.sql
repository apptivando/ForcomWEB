-- ============================================================
-- 023 — Escritura del sitio solo para miembros del panel (29/10/2026)
-- ============================================================
--
-- POR QUÉ
-- Las policies de las tablas del sitio (products, hero_content, hero_slides,
-- company_info, contact_messages) y de los buckets de imágenes dejan escribir
-- a CUALQUIER usuario logueado: `auth.uid() IS NOT NULL`. Mientras el único
-- que tenía usuarios en este proyecto de Supabase era el panel de FORCOM, eso
-- equivalía a "miembro del panel" (el gate de src/proxy.ts frena al resto).
--
-- Eso se termina con Latin Office (repo LatinOfficeWEB): usa ESTE MISMO
-- proyecto de Supabase, con sus tablas `lo_` y su propia lista de miembros
-- (`lo_admin_members`), pero los usuarios de Supabase Auth (auth.users) son
-- los mismos. Alguien que solo es miembro de Latin Office tiene una sesión
-- válida, y con supabase-js y la clave anon (que es pública) podría editar
-- productos, hero, datos de la empresa, leer y borrar los mensajes del
-- formulario de FORCOM, o subir/borrar archivos en `product-images`. El proxy
-- no lo frena: protege las pantallas de /admin, no la Data API.
--
-- QUÉ HACE
-- Cambia `auth.uid() IS NOT NULL` por `public.current_admin_role() IS NOT NULL`
-- (la función de la 001: rol en admin_members, o NULL si no es miembro de
-- FORCOM) en todo lo que es escritura o lectura del panel. El acceso público
-- queda exactamente como lo necesita el sitio:
--
--   · products      → lectura pública solo de `active = true`.
--   · hero_slides   → lectura pública solo de `active = true`.
--   · hero_content  → lectura pública (fila única).
--   · company_info  → lectura pública (fila única: WhatsApp, email, catálogo).
--   · contact_messages → INSERT público SIN select (018 y el Gotcha de
--     CLAUDE.md sobre `.insert().select()`): anon deja un mensaje y no puede
--     leer el buzón.
--   · Storage `product-images` (fotos en `products/` y descargables de
--     ProductFilesEditor en `files/`) y `hero-slides` (fotos del carrusel,
--     HeroSlideForm): lectura pública, subir y borrar solo miembros.
--
-- No toca admin_members, admin_invitations ni admin_password_resets: esas ya
-- exigen ser miembro (001) o están cerradas del todo (016).
--
-- QUÉ SIGUE ANDANDO
--   · El panel de FORCOM: las acciones usan la sesión del miembro, y el miembro
--     tiene rol en admin_members → pasa todas las policies nuevas.
--   · El sitio público: usa anon sin sesión y ya filtra `active = true` en
--     products y hero_slides (page.tsx, catalogo, productos/[slug], sitemap).
--   · /api/contact: inserta con anon y sin `.select()`.
--   · Las acciones con service role (src/lib/supabase/admin.ts) saltean RLS.
--
-- QUÉ CAMBIA PARA UN USUARIO QUE NO ES MIEMBRO DE FORCOM
-- Lee lo mismo que anon. Sus UPDATE/DELETE afectan 0 filas SIN error (así se
-- comporta RLS), y sus INSERT dan 42501.
--
-- GRANTs: estas tablas son anteriores al cambio de Supabase del 30/10/2026, así
-- que ya tienen los GRANT de siempre para anon y authenticated. No se tocan.
-- La única excepción es el EXECUTE de current_admin_role() (paso 2): las
-- policies nuevas la llaman, y si anon/authenticated no la pudieran ejecutar
-- las lecturas fallarían con "permission denied for function".
--
-- CÓMO CORRERLA
--   1. Correr SOLO el paso 0 (seleccionarlo y Run) y guardar el resultado: es
--      el registro de las policies que había antes. El SQL Editor muestra solo
--      el resultado de la última consulta, así que si se corre todo junto ese
--      listado no se ve.
--   2. Revisar que ninguna policy de storage del paso 0 mezcle un bucket de
--      FORCOM con uno de otro sitio (ej. `bucket_id IN ('product-images',
--      'lo-...')`): el paso 3 la borraría entera.
--   3. Correr el archivo completo. Va en una transacción: o queda todo o nada.
--
-- Se puede correr más de una vez. Correr en el SQL Editor de Supabase.

-- 0. Policies actuales (correr solo, antes que el resto)
SELECT 'public' AS esquema, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('products', 'hero_content', 'hero_slides', 'company_info', 'contact_messages')
UNION ALL
SELECT 'storage', tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (
       policyname ILIKE '%product-images%'
    OR policyname ILIKE '%hero-slides%'
    OR COALESCE(qual, '') || ' ' || COALESCE(with_check, '') LIKE '%''product-images''%'
    OR COALESCE(qual, '') || ' ' || COALESCE(with_check, '') LIKE '%''hero-slides''%'
  )
ORDER BY 1, 2, 4, 3;

-- Opcional: confirmar que existen los dos buckets y que son públicos.
-- SELECT id, public FROM storage.buckets WHERE id IN ('product-images', 'hero-slides');


BEGIN;

-- 1. RLS activa en las cinco tablas del sitio
-- hero_slides y company_info no están en schema.sql: se crearon a mano desde el
-- Dashboard. Esto no hace nada si ya estaba activa, y si no lo estaba, las
-- policies de abajo dejan pasar exactamente lo que el sitio necesita.
ALTER TABLE public.products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_content     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_slides      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_info     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- 2. Que todos puedan ejecutar current_admin_role()
-- Por defecto Postgres le da EXECUTE a PUBLIC, así que casi seguro esto ya
-- estaba. Se deja explícito porque ahora la lectura del panel depende de la
-- función: sin el permiso, un SELECT con sesión fallaría entero. Para anon
-- devuelve NULL (auth.uid() es NULL), y es SECURITY DEFINER, así que no expone
-- admin_members: solo dice el rol de quien pregunta.
GRANT EXECUTE ON FUNCTION public.current_admin_role() TO anon, authenticated;

-- 3. Borrar las policies actuales
-- No sabemos con certeza los nombres de todas (las de hero_slides y
-- company_info se hicieron desde el Dashboard), así que se borran todas las de
-- estas cinco tablas, y en storage.objects solo las que mencionan uno de los
-- dos buckets de FORCOM en el nombre o en la definición. Las de otros buckets
-- (ej. los de Latin Office) no se tocan.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('products', 'hero_content', 'hero_slides', 'company_info', 'contact_messages')
  LOOP
    RAISE NOTICE 'Borrando policy "%" de %.%', p.policyname, p.schemaname, p.tablename;
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;

  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
           policyname ILIKE '%product-images%'
        OR policyname ILIKE '%hero-slides%'
        -- Con las comillas: así no agarra un bucket que solo CONTENGA el
        -- nombre, como 'lo-product-images'.
        OR COALESCE(qual, '') || ' ' || COALESCE(with_check, '') LIKE '%''product-images''%'
        OR COALESCE(qual, '') || ' ' || COALESCE(with_check, '') LIKE '%''hero-slides''%'
      )
  LOOP
    RAISE NOTICE 'Borrando policy "%" de storage.objects', p.policyname;
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- Nota sobre las policies de abajo
-- · Las de lectura pública van `TO anon, authenticated` y no llaman a la
--   función: anon nunca la evalúa.
-- · Las del panel van `TO authenticated` y usan `(SELECT public.current_admin_role())`
--   entre paréntesis: así Postgres la evalúa una vez por consulta y no una vez
--   por fila.
-- · Las policies del mismo comando se suman con OR: un miembro ve lo público
--   más lo suyo.

-- 4. products
-- El sitio lee solo activos. El panel lee todo (la lista de /admin/productos
-- muestra los inactivos, y uniqueSlug() busca slugs repetidos entre todos).
CREATE POLICY "Public read active products" ON public.products
  FOR SELECT TO anon, authenticated
  USING (active = true);

CREATE POLICY "Members read all products" ON public.products
  FOR SELECT TO authenticated
  USING ((SELECT public.current_admin_role()) IS NOT NULL);

CREATE POLICY "Members insert products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_admin_role()) IS NOT NULL);

CREATE POLICY "Members update products" ON public.products
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_admin_role()) IS NOT NULL)
  WITH CHECK ((SELECT public.current_admin_role()) IS NOT NULL);

CREATE POLICY "Members delete products" ON public.products
  FOR DELETE TO authenticated
  USING ((SELECT public.current_admin_role()) IS NOT NULL);

-- 5. hero_slides
-- Igual que products: el carrusel muestra solo los activos; el panel, todos.
-- createHeroSlide y updateHeroSlide hacen `.select()` después de escribir:
-- funciona porque el miembro tiene la policy de lectura completa.
CREATE POLICY "Public read active hero slides" ON public.hero_slides
  FOR SELECT TO anon, authenticated
  USING (active = true);

CREATE POLICY "Members read all hero slides" ON public.hero_slides
  FOR SELECT TO authenticated
  USING ((SELECT public.current_admin_role()) IS NOT NULL);

CREATE POLICY "Members insert hero slides" ON public.hero_slides
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_admin_role()) IS NOT NULL);

CREATE POLICY "Members update hero slides" ON public.hero_slides
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_admin_role()) IS NOT NULL)
  WITH CHECK ((SELECT public.current_admin_role()) IS NOT NULL);

CREATE POLICY "Members delete hero slides" ON public.hero_slides
  FOR DELETE TO authenticated
  USING ((SELECT public.current_admin_role()) IS NOT NULL);

-- 6. hero_content (fila única id=1)
-- Hoy el sitio no la lee (el hero sale de hero_slides), pero la lectura
-- pública ya estaba y no expone nada que no se haya publicado. Solo UPDATE: la
-- fila existe y nadie inserta ni borra.
CREATE POLICY "Public read hero" ON public.hero_content
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Members update hero" ON public.hero_content
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_admin_role()) IS NOT NULL)
  WITH CHECK ((SELECT public.current_admin_role()) IS NOT NULL);

-- 7. company_info (fila única id=1)
-- El sitio la lee entera (`select("*")`) en el home, el catálogo, la ficha de
-- producto y el sitemap. El panel la actualiza desde Empresa y Catálogo. Solo
-- UPDATE, igual que hero_content.
CREATE POLICY "Public read company info" ON public.company_info
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Members update company info" ON public.company_info
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_admin_role()) IS NOT NULL)
  WITH CHECK ((SELECT public.current_admin_role()) IS NOT NULL);

-- 8. contact_messages
-- El INSERT público es el de la 018, tal cual. NO agregar un SELECT para anon:
-- dejaría leer el buzón entero desde cualquier navegador. /api/contact inserta
-- sin `.select()` justamente por eso (ver Gotchas en CLAUDE.md).
CREATE POLICY "Anyone can submit contact" ON public.contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Members read messages" ON public.contact_messages
  FOR SELECT TO authenticated
  USING ((SELECT public.current_admin_role()) IS NOT NULL);

CREATE POLICY "Members update messages" ON public.contact_messages
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_admin_role()) IS NOT NULL)
  WITH CHECK ((SELECT public.current_admin_role()) IS NOT NULL);

CREATE POLICY "Members delete messages" ON public.contact_messages
  FOR DELETE TO authenticated
  USING ((SELECT public.current_admin_role()) IS NOT NULL);

-- 9. Storage: product-images y hero-slides
-- Los dos buckets son públicos: las URLs de getPublicUrl() se sirven sin pasar
-- por estas policies. La de SELECT ya estaba (permite listar el bucket con la
-- clave anon) y se mantiene para no cambiar el comportamiento.
-- Sin policy de UPDATE a propósito: todas las subidas son con `upsert: false`
-- (ImageGalleryEditor, ProductFilesEditor, HeroSlideForm). Si algún día se
-- pasa a `upsert: true`, hace falta agregar UPDATE (y SELECT) para miembros.
CREATE POLICY "Public read product-images" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Members upload product-images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (SELECT public.current_admin_role()) IS NOT NULL);

CREATE POLICY "Members delete product-images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND (SELECT public.current_admin_role()) IS NOT NULL);

CREATE POLICY "Public read hero-slides" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'hero-slides');

CREATE POLICY "Members upload hero-slides" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hero-slides' AND (SELECT public.current_admin_role()) IS NOT NULL);

CREATE POLICY "Members delete hero-slides" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'hero-slides' AND (SELECT public.current_admin_role()) IS NOT NULL);

COMMIT;

-- 10. Prueba opcional, con los roles reales (no deja nada escrito)
-- Como anon: tiene que contar solo los productos activos y 0 mensajes.
--   BEGIN;
--   SET LOCAL ROLE anon;
--   SELECT (SELECT COUNT(*) FROM public.products) AS productos_visibles,
--          (SELECT COUNT(*) FROM public.contact_messages) AS mensajes_debe_ser_0;
--   ROLLBACK;
-- Como un usuario logueado que NO es miembro de FORCOM (poner su id de
-- auth.users): mismo resultado que anon, y el UPDATE tiene que afectar 0 filas.
--   BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true);
--   SELECT (SELECT COUNT(*) FROM public.contact_messages) AS mensajes_debe_ser_0;
--   UPDATE public.company_info SET updated_at = NOW() WHERE id = 1;  -- "UPDATE 0"
--   ROLLBACK;

-- 11. Verificación
-- Una fila por policy. `alerta` tiene que quedar vacía en todas: marca lo que
-- escribe sin pedir ser miembro (salvo el formulario) o lo que todavía usa
-- `auth.uid() IS NOT NULL`. Lo esperado: products 5, hero_slides 5,
-- hero_content 2, company_info 2, contact_messages 4, storage.objects 6.
SELECT
  schemaname || '.' || tablename AS tabla,
  cmd,
  policyname,
  roles,
  COALESCE(qual, '') || CASE WHEN with_check IS NOT NULL THEN ' | CHECK ' || with_check ELSE '' END AS definicion,
  CASE
    WHEN COALESCE(qual, '') || COALESCE(with_check, '') LIKE '%auth.uid() IS NOT NULL%'
      THEN 'USA auth.uid() IS NOT NULL'
    WHEN cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
     AND NOT (tablename = 'contact_messages' AND cmd = 'INSERT')
     AND COALESCE(qual, '') || COALESCE(with_check, '') NOT LIKE '%current_admin_role()%'
      THEN 'ESCRIBE SIN SER MIEMBRO'
    ELSE ''
  END AS alerta
FROM pg_policies
WHERE (schemaname = 'public'
       AND tablename IN ('products', 'hero_content', 'hero_slides', 'company_info', 'contact_messages'))
   OR (schemaname = 'storage' AND tablename = 'objects'
       AND COALESCE(qual, '') || ' ' || COALESCE(with_check, '') ~ '''(product-images|hero-slides)''')
ORDER BY tabla, cmd, policyname;
