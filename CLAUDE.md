@AGENTS.md

# FORCOM Web — Contexto del proyecto

## Qué es esto

Sitio web B2B de presentación y generación de leads para FORCOM, distribuidor de hardware POS en Argentina. Catálogo de 15 productos en 6 categorías (Smart POS, Mini PC, Impresoras, Lectores, Verificadores, Accesorios). Target: supermercados, restaurantes, farmacias, logística, estaciones de servicio, hotelería.

**Stack:** Next.js (App Router) · React 19 · TypeScript · Tailwind CSS 4  
**Fuentes:** Barlow Condensed (display/headings) + DM Sans (body)  
**Dominio:** forcom.tech (en producción)

## Reglas de trabajo

### Cómo armar un plan

Todo plan que le presente al usuario debe tener esta estructura, en este orden:

1. **Cómo funcionaría** — explicar en términos simples el funcionamiento resultante, sin jerga de implementación.
2. **Tareas del usuario** — qué tiene que hacer el usuario (ej. crear o modificar tablas/políticas en Supabase, cargar variables de entorno, crear cuentas de terceros), como pasos concretos y accionables.
3. **Tareas propias** — qué voy a hacer yo; acá sí mostrar los cambios de archivos y código (diffs, snippets, nombres de archivo).

### Al terminar una tarea

Verificar que el build salga limpio (`npm run build`) antes de dar la tarea por terminada. Si el build sale limpio, hacer push: a `develop` si esa rama existe en el repo, si no, directo a `main`.

## Decisión de plataforma

Se comenzó con un plan en WordPress (ver `../PLANCMS.md`) pero se migró a Next.js. El PLANCMS.md es un documento desactualizado — ignorarlo.

## Sistema de diseño

```
--black:       #0D0D0F   (fondo principal)
--dark:        #141416   (fondo secciones alternas)
--card:        #1A1A1E   (fondo tarjetas)
--border:      #2A2A2E   (bordes)
--red:         #E8231A   (acento primario, CTAs)
--red-dark:    #C41D16   (hover del rojo)
--gray:        #8A8A8A   (texto secundario)
--gray-light:  #B0B0B0   (texto links nav, subtítulos)
```

Border-radius: `rounded-sm` (2px) en todo el sitio — look industrial, no bubbly.  
Sin librerías de animación — todo CSS + IntersectionObserver nativo.  
Sin librerías de UI (no shadcn, no MUI) — componentes propios con Tailwind.

## Estructura de componentes

```
src/
├── app/
│   ├── layout.tsx            — metadata, fuentes Google, favicon
│   ├── page.tsx              — composición de secciones (server component)
│   ├── globals.css           — variables CSS, animaciones, clases utilitarias
│   └── admin/
│       ├── actions.ts        — server actions: hero, productos, CRM
│       └── (panel)/          — rutas protegidas del admin
│           ├── dashboard/    — stats
│           ├── hero/         — editor de slides del hero carousel
│           ├── productos/    — CRUD de productos
│           ├── empresa/      — datos de contacto (WhatsApp, email, etc.)
│           └── crm/          — bandeja de mensajes de contacto
├── components/
│   ├── Navbar.tsx            — nav fijo, scroll effect, menú mobile
│   ├── HeroCarousel.tsx      — carousel hero con slides dinámicos desde DB
│   ├── ProductCategories.tsx — 6 category cards con hover
│   ├── ProductCards.tsx      — grid de productos (DB), cada card linkea a /productos/[slug]
│   ├── ProductDetails.tsx    — carrusel, specs (parser markdown), videos, archivos — usado en /productos/[slug]
│   ├── WhyForcom.tsx         — 6 diferenciadores en grid 3x2
│   ├── Industries.tsx        — 6 industrias verticales
│   ├── Contact.tsx           — formulario con validación (datos desde company_info)
│   ├── WhatsAppFAB.tsx       — botón flotante WhatsApp (número desde DB)
│   ├── Footer.tsx            — links, copyright dinámico
│   ├── ForcomLogo.tsx        — logo PNG via next/image (NO volver a SVG — el ® desaparecía)
│   ├── ScrollReveal.tsx      — IntersectionObserver para reveal on scroll
│   └── admin/
│       ├── ProductForm.tsx   — formulario CRUD de producto (incluye ImageGalleryEditor)
│       ├── ImageGalleryEditor.tsx — upload a Supabase Storage + galería drag-to-reorder
│       ├── ProductsTable.tsx
│       ├── HeroEditor.tsx
│       ├── CRMInbox.tsx
│       └── AdminSidebar.tsx
└── lib/
    ├── types.ts              — Product, ProductFile, HeroSlide, CompanyInfo, ContactMessage
    └── supabase/
        ├── client.ts         — createBrowserClient (para componentes cliente)
        └── server.ts         — createServerClient con try-catch en setAll (requerido en prod)
```

## Base de datos (Supabase PostgreSQL)

### Tablas principales

**`products`** — catálogo de productos
- Campos base: `id`, `model`, `category`, `section`, `section_id`, `badge`, `image_url`, `specs TEXT[]`, `active`, `order_index`
- Campos del modal (agregados jun-2026): `images TEXT[]` (galería, hasta 5), `videos TEXT[]` (hasta 2), `description TEXT`, `full_specs TEXT` (markdown con tablas), `files JSONB` (array de `{name, url, type}`)
- `image_url` se auto-popula con `images[0]` al guardar desde el admin

**`hero_content`** — configuración estática del hero (fila única id=1)

**`hero_slides`** — slides dinámicos del carousel hero

**`company_info`** — fila única (id=1): `whatsapp`, `email`, `phone`, `schedule` — fuente de verdad para datos de contacto

**`contact_messages`** — CRM: mensajes del formulario de contacto

### Storage

**Bucket `product-images`** (público) — imágenes subidas desde el admin.  
Políticas: SELECT público, INSERT/DELETE solo autenticados.  
Path de archivos: `products/{timestamp}-{slug}.{ext}`

## Para correr el proyecto

```bash
cd forcom-web
npm run dev
# → http://localhost:3000
```

## Deploy e infraestructura

- **Repo:** github.com/apptivando/ForcomWEB
- **Ramas:** `main` (producción) · `develop` (previews)
- **Vercel:** proyecto `forcom-web` bajo equipo `apptivando`
- **Dominios:** `www.forcom.tech` → main · `dev.forcom.tech` → develop
- **DNS:** gestionado en Donweb. Registros de mail (mx1, mail, autoconfig, autodiscover) son de correo externo — no tocar.
- **Variables en Vercel:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (`noreply@forcom.tech`), `RESEND_TO_EMAIL` (`ventas@forcom.tech`).

### Gotchas críticos

- **Framework Preset en Vercel** debe ser "Next.js" (no "Other") — si queda en Other, 404 en todas las rutas.
- **`src/lib/supabase/server.ts`** tiene try-catch en `setAll` — requerido porque App Router no permite setear cookies desde Server Components; sin él falla en producción.
- **Auth middleware** está en `src/lib/supabase/middleware-proxy.ts`. NO nombrarlo `middleware.ts` ni ponerlo en raíz de `src/`.
- **Logo** usa `next/image` con PNG (`/images/brand/forcom-logo.png`). No volver a SVG con texto — el ® desaparecía y perdía calidad.
- **HeroCarousel usa `h-screen` (no `min-h-screen`)** — con `min-h-screen` la sección se alargaba en algunos slides y la navegación quedaba fuera del viewport. La navegación está posicionada `absolute bottom-6` para que siempre sea visible. No volver a flujo normal ni a `min-h-screen`.
- **Hero mobile layout (30/06/2026)** — `section` usa `items-start md:items-center`: en mobile el contenido arranca justo bajo la navbar (elimina el dead space superior), en desktop queda centrado verticalmente. Imagen: `w-80 h-80` fijo en mobile, `md:w-full md:h-auto md:aspect-square` en desktop. Las decoraciones (esquinas rojas, borde rotado, badge de producto) son visibles en todos los tamaños — no agregar `hidden md:block` a esos elementos. Trust badges: `flex justify-center sm:justify-start text-xs sm:text-sm` (visibles en mobile, centrados). Scroll indicator `sm:hidden` al fondo del texto. Título: `text-center sm:text-left`.

## Estado actual (junio 2026)

### Hecho
- Homepage completa con 8 secciones, dark theme industrial, animaciones scroll reveal
- Responsive mobile/tablet/desktop — Hero con imagen visible en mobile, decoraciones y trust badges presentes en todos los tamaños
- Admin panel completo: CRM, productos, hero slides, info empresa
- Supabase: productos, hero, CRM y datos de empresa desde DB
- WhatsApp FAB con número dinámico desde `company_info`
- Páginas de producto individuales con URL propia (20/07/2026): `/productos/[slug]` (server component) con metadata (title/description/OG), JSON-LD `Product`, breadcrumb, CTA WhatsApp con mensaje precargado y "Productos relacionados". El contenido de specs (carrusel de imágenes, descripción, tabla de specs vía parser de markdown, videos, archivos descargables) vive en `ProductDetails.tsx`, compartido — reemplaza al antiguo modal `ProductSpecsModal.tsx` (eliminado). El slug se genera automáticamente desde el modelo en `upsertProduct` (`admin/actions.ts`), con sufijo `-2`, `-3`... si hay choque. **Pendiente:** correr en Supabase la migración de la columna `slug` (al final de `supabase/schema.sql`) antes de que estas páginas sirvan datos reales — sin eso, `products.slug` no existe todavía en la DB de producción.
- Upload de imágenes al admin: `ImageGalleryEditor` sube a Supabase Storage, galería visual con drag-to-reorder, hasta 5 fotos por producto
- Formulario admin de producto con galería, videos, descripción, specs completas y archivos descargables
- Formulario de contacto activo: guarda en CRM + notificación interna + auto-reply al cliente vía Resend
- `description` y `full_specs` de los 18 productos cargados desde `../FORCOM_Catalogo_1Q_2026.md` vía script de migración
- Deploy en Vercel funcionando en forcom.tech
- **GA4** activo en producción (`G-RG61BCBYT0`) via `NEXT_PUBLIC_GA_ID` + `GoogleAnalytics.tsx` (next/script afterInteractive)
- **SEO completo (30/06/2026):** `app/sitemap.ts` (genera `/sitemap.xml`), `app/robots.ts`, JSON-LD `Organization` en layout.tsx, JSON-LD `ItemList` de productos en page.tsx, Open Graph tags
- **Google Search Console** verificado (etiqueta HTML) + sitemap enviado y correcto (1 página)
- **Número de WhatsApp real** cargado en `/admin/empresa`
- **Fotos de los 18 productos cargadas (03/07/2026)** vía `scripts/bulk-upload-images.js`, a partir de `../FORCOM 800x600/` (carpetas por producto con hasta 5 fotos c/u, provistas por el cliente).
- **DNS de dev.forcom.tech validado en Vercel.**
- **Producto "T5 Smart-POS" renombrado a "A5 Smart-POS"** (mismo id `aa681863`) — las fotos reales del equipo estaban en la carpeta `POS A5`, no en `POS T5 doble` (esta última quedó sin mapear, era de una variante de doble pantalla no cargada en la DB). Fotos del A5 cargadas (08/07/2026) vía `bulk-upload-images.js "POS A5" --commit` (agregado soporte de filtro por carpeta al script).

### Pendiente para MVP
_(ninguno — bloque MVP técnico completo)_

### Pendiente post-MVP
- Blog `/blog`
- Páginas de soluciones por industria `/soluciones/[industria]`
- Sistema de cotización / carrito
- Testimonios y logos de clientes
- Eliminación de imágenes del bucket al quitar foto de galería en el admin
- Google Business Profile

## Scripts utilitarios

```
scripts/
├── fetch-products.mjs      — lista id, model, section, category de todos los productos en Supabase
├── import-catalog.mjs      — importa description y full_specs desde FORCOM_Catalogo_1Q_2026.md
│                             Requiere SUPABASE_SERVICE_KEY en .env.local (service_role key, bypasea RLS)
│                             Dry-run: node scripts/import-catalog.mjs
│                             Carga:   node scripts/import-catalog.mjs --update
└── bulk-upload-images.js   — carga masiva de fotos: lee carpetas en `../FORCOM 800x600/<carpeta>`,
                              mapea carpeta→producto por un diccionario FOLDER_TO_MODEL hardcodeado
                              en el script, sube hasta 5 fotos (primeras en orden alfabético) a Storage
                              con paths `products/{slug-modelo}-{01..05}.png` (sufijo numérico, no el
                              nombre original — varios archivos de origen difieren solo en espacios/puntos
                              finales y colisionaban en el mismo path al pasarlos por slugify).
                              Actualiza `images` + `image_url` del producto (reemplaza, no agrega).
                              Corre todas las carpetas mapeadas por default; acepta un nombre de
                              carpeta como argumento posicional para limitar a una sola (útil para
                              recargar un producto puntual sin re-subir el resto).
                              Dry-run:        node scripts/bulk-upload-images.js
                              Dry-run 1 carpeta: node scripts/bulk-upload-images.js "POS A5"
                              Carga:           node scripts/bulk-upload-images.js --commit
                              Carga 1 carpeta: node scripts/bulk-upload-images.js "POS A5" --commit
                              Si llegan carpetas nuevas de fotos, agregar sus entradas a FOLDER_TO_MODEL.
```

La `SUPABASE_SERVICE_KEY` solo va en `.env.local` — nunca a Vercel ni al cliente.

## Artefactos generados

- `../FORCOM_preview.html` — preview standalone del sitio
- `../design-audit/` — screenshots del design review con gstack
- `../FORCOM_Catalogo_1Q_2026.md` — catálogo de 20 productos con specs y tablas
- `../TAREAS_PENDIENTES.md` — listado completo de 95 tareas pendientes (MVP + post-MVP + contenido por producto), listo para importar a Notion
