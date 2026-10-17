-- ============================================================
-- 021 — Link del catálogo de Publuu (16/10/2026)
-- ============================================================
--
-- El cliente publica su catálogo como flipbook en Publuu y lo quiere
-- embebido en el sitio (/catalogo), con el menú de FORCOM visible arriba.
-- Cada catálogo nuevo puede salir con otro link, así que se carga desde el
-- panel (Sitio → Catálogo) en vez de quedar fijo en el código.
--
-- Va como columna de `company_info` (fila única id=1) y no como tabla nueva:
-- es un dato suelto del sitio, igual que el WhatsApp o el email. Al ser una
-- columna de una tabla existente hereda sus GRANT y sus policies — el sitio
-- público ya la lee sin sesión y el panel ya la actualiza.
--
-- Vacío (NULL) = no hay catálogo: el ítem del menú se oculta y /catalogo
-- devuelve 404.
--
-- Se puede correr más de una vez. Correr en el SQL Editor de Supabase.

-- 1. La columna, con el catálogo actual (el que pasó el cliente)

ALTER TABLE public.company_info
  ADD COLUMN IF NOT EXISTS catalog_url TEXT;

UPDATE public.company_info
SET catalog_url = 'https://publuu.com/flip-book/216706/1518341'
WHERE id = 1 AND catalog_url IS NULL;

-- 2. Verificación
-- Tiene que devolver una fila con el link de Publuu.
SELECT id, catalog_url FROM public.company_info;
