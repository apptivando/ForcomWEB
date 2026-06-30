@AGENTS.md

# FORCOM Web — Contexto del proyecto

## Qué es esto

Sitio web B2B de presentación y generación de leads para FORCOM, distribuidor de hardware POS en Argentina. Catálogo de 15 productos en 6 categorías (Smart POS, Mini PC, Impresoras, Lectores, Verificadores, Accesorios). Target: supermercados, restaurantes, farmacias, logística, estaciones de servicio, hotelería.

**Stack:** Next.js (App Router) · React 19 · TypeScript · Tailwind CSS 4  
**Fuentes:** Barlow Condensed (display/headings) + DM Sans (body)  
**Dominio:** forcom.tech (en producción)

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
│   ├── ProductCards.tsx      — grid de productos (DB) + trigger del modal
│   ├── ProductSpecsModal.tsx — drawer lateral: carrusel, specs, videos, archivos
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
- Modal lateral "Ver especificaciones" (`ProductSpecsModal.tsx`): carrusel de imágenes, descripción, tabla de specs (parser de markdown), videos y archivos descargables
- Upload de imágenes al admin: `ImageGalleryEditor` sube a Supabase Storage, galería visual con drag-to-reorder, hasta 5 fotos por producto
- Formulario admin de producto con galería, videos, descripción, specs completas y archivos descargables
- Formulario de contacto activo: guarda en CRM + notificación interna + auto-reply al cliente vía Resend
- `description` y `full_specs` de los 18 productos cargados desde `../FORCOM_Catalogo_1Q_2026.md` vía script de migración
- Deploy en Vercel funcionando en forcom.tech

### Pendiente para MVP
- Cargar **fotos** de los productos en el admin (specs y descripción ya están cargadas)
- **Actualizar número de WhatsApp real** en `/admin/empresa` (actualmente placeholder)
- Analytics (GA4)
- SEO: sitemap.xml (`app/sitemap.ts`), robots.txt (`app/robots.ts`), schema markup Product JSON-LD
- Validar DNS de dev.forcom.tech en Vercel (estado: "Invalid Configuration")

### Pendiente post-MVP
- Blog `/blog`
- Páginas de soluciones por industria `/soluciones/[industria]`
- Sistema de cotización / carrito
- Testimonios y logos de clientes
- Eliminación de imágenes del bucket al quitar foto de galería en el admin
- Páginas de producto individuales con URL propia (para SEO)
- Google Business Profile

## Scripts utilitarios

```
scripts/
├── fetch-products.mjs   — lista id, model, section, category de todos los productos en Supabase
└── import-catalog.mjs   — importa description y full_specs desde FORCOM_Catalogo_1Q_2026.md
                           Requiere SUPABASE_SERVICE_KEY en .env.local (service_role key, bypasea RLS)
                           Dry-run: node scripts/import-catalog.mjs
                           Carga:   node scripts/import-catalog.mjs --update
```

La `SUPABASE_SERVICE_KEY` solo va en `.env.local` — nunca a Vercel ni al cliente.

## Artefactos generados

- `../FORCOM_preview.html` — preview standalone del sitio
- `../design-audit/` — screenshots del design review con gstack
- `../FORCOM_Catalogo_1Q_2026.md` — catálogo de 20 productos con specs y tablas
- `../TAREAS_PENDIENTES.md` — listado completo de 95 tareas pendientes (MVP + post-MVP + contenido por producto), listo para importar a Notion
