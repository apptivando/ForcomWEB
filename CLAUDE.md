@AGENTS.md

# FORCOM Web — Contexto del proyecto

## Qué es esto

Sitio web B2B de presentación y generación de leads para FORCOM, fabricante de hardware POS en Argentina. Catálogo de 15 productos en 6 categorías (Smart POS, Mini PC, Impresoras, Lectores, Verificadores, Accesorios). Target: supermercados, restaurantes, farmacias, logística, estaciones de servicio, hotelería.

**Posicionamiento (definido por el cliente, 06/08/2026): FORCOM es fábrica, no revendedor ni distribuidor.** Ningún texto del sitio debe describirla como revendedora, distribuidora o importadora. El argumento a usar es el que habilita fabricar: adaptar el equipo a la operación del cliente, sostener repuestos en el tiempo y dar garantía directa sin depender de una marca ajena. Aplica también a metadata, JSON-LD y textos del admin.

**Stack:** Next.js (App Router) · React 19 · TypeScript · Tailwind CSS 4  
**Fuentes:** Barlow Condensed (display/headings) + DM Sans (body)  
**Dominio:** forcom.tech (en producción)

## CRM de WhatsApp (proyecto en curso, iniciado 30/07/2026)

> ## ⚠️ CAMBIO DE RUMBO (06/08/2026): el fork de wacrm se discontinúa
>
> **El CRM de WhatsApp se construye dentro de este repo (Track E), no como app separada.** Motivo: unificación — un solo deploy, una sola base, un solo login. El fork de wacrm (`apptivando/ForcomCRM`, proyecto de Vercel `forcom-crm`) **no se migra a la cuenta nueva de Vercel y se apaga**.
>
> Lo que sigue vigente de esta sección es el contexto histórico y las lecciones (sobre todo `normalizeArgentinePhone`). Lo que **ya no** aplica: el proxy `/admin/crm/*`, las variables `WACRM_*`, y el dominio `crm-dev.forcom.tech`.
>
> **Estado del Track E (21/08/2026):** cerrado. Fase 1 roles · 2 tablas CRM + webhook · 3 bandeja · 4 asistente IA · 5 pipelines · 6 automatizaciones · 7 el formulario entra al CRM · 8 clientes unificados + buscador de prospectos · 9 ficha de cliente con línea de tiempo · 10 líneas de vendedores y análisis de conversaciones. Migraciones 010 a 014 corridas en Supabase. Falta cablear las `EVOLUTION_*` en Vercel.
>
> **Documentación**: `docs/PROSPECTOS.md` (buscador de prospectos, enriquecimiento, contacto en frío, ficha de cliente) y `docs/WHATSAPP.md` (las dos líneas, captura desde el celular, análisis de vendedores).
>
> **Verificación**: `node scripts/verify-prospects.mjs` chequea las migraciones 010-014 y el estado de los datos. Con `--live` además prueba las APIs de Google y el trigger del Pipeline.
>
> **Espejar una migración nueva en `schema.sql`**: `node scripts/sync-schema.mjs`, después de agregarla al array `MIRRORED` de ese script. No copiar a mano ni con un script de un solo uso — el anterior truncaba desde su propio marcador y se llevó puestas dos migraciones.
>
> **`crm_contacts` ya no son "los contactos de WhatsApp": es la tabla única de clientes.** Desde la migración `010` también entran ahí los prospectos del scraper de Google Places y los leads del formulario web, diferenciados por la columna `origin`. Dos consecuencias que rompen código si se ignoran: (a) `phone` es **nullable**; (b) la columna `name` se renombró a **`contact_name`** (la persona) y se agregó **`business_name`** (la razón social) — las escriben fuentes distintas y no se pisan; (c) `contact_tier` es **GENERATED, de solo lectura**: mandarla en un insert/update revienta, así que nada de `select('*')` → `upsert(row)` sobre esa tabla.
>
> **Conexión a WhatsApp: Evolution API self-hosted** (WSL, detrás de Cloudflare Tunnel), no Baileys ni Meta directo.
>
> **Checklist del apagado y de la migración de Vercel:** `../MIGRACION_VERCEL.md`, Track 1A.

Contexto histórico: FORCOM iba a reemplazar el CRM interno (`contact_messages` + `/admin/crm` + `CRMInbox.tsx`, ver abajo) por un fork de [wacrm](https://github.com/ArnasDon/wacrm), desplegado como app independiente y accedido desde `forcom.tech/admin/crm` vía reverse proxy — no vive en este repo.

- **Plan maestro** (todas las tracks, checklist): `C:\Users\guill\.claude\plans\puedes-investigar-este-repositorio-peaceful-whistle.md`
- **Repo y contexto técnico del CRM:** `c:\Apptivando\wacrm` (repo `apptivando/ForcomCRM`), ver su `CLAUDE.md`
- **Estado:** el CRM ya está desplegado y probado de punta a punta con un canal de WhatsApp de pruebas (no el oficial de Meta todavía).
  - ✅ **Proxy `/admin/crm/*` → el deploy del CRM**, en `next.config.ts` (`rewrites()`, fase `beforeFiles` — tiene que ganarle a la página propia `/admin/crm` que todavía existe). URL del deploy configurable por `WACRM_DEPLOYMENT_URL` (default `https://forcom-crm.vercel.app`).
  - ✅ **De paso se corrigió un bug de seguridad no relacionado**: el auth gate de `/admin/*` vivía en un archivo (`middleware-proxy.ts`) que nunca se ejecutaba — ver "Gotchas críticos". Sin corregirlo, el proxy nuevo hubiera quedado sin protección de login.
  - ✅ **Teléfono opcional en `Contact.tsx`** + columna `contact_messages.phone` (migración corrida en Supabase) + `/api/contact/route.ts` normaliza a E.164 argentino (`+549<área><número>`, `normalizeArgentinePhone`) y avisa a wacrm con `POST /api/v1/contacts` + `POST /api/v1/messages` cuando hay teléfono válido, con logging de errores reales (no silencioso). Probado de punta a punta: contacto + mensaje aparecen en wacrm. **Ojo:** wacrm guarda los teléfonos SIN el `+` inicial (ej. `5491122339988`) aunque se los mandemos con `+` — no filtrar por igualdad exacta con `+` incluido al consultar `contacts.phone` directo en Supabase.
  - **Lección sobre `normalizeArgentinePhone`**: la primera versión intentaba detectar y sacar el viejo prefijo local "15" (ej. `011 15-1234-5678`) — se sacó por completo, porque en la costumbre argentina actual (área + número directo, sin 0 ni 15, ej. `3515181882`) el "15" aparece tan seguido *por coincidencia* en el borde entre área y número (ej. área `351` + número que arranca en `5` arma un "15" ahí) que rompía números reales más seguido de lo que arreglaba los pocos casos viejo-estilo. La versión actual es más simple (solo saca `+54`/`54`, `9`, `0` iniciales) y ante cualquier duda devuelve `null` (falla segura) en vez de mandar un número corrompido.
  - ⬜ Retirar `CRMInbox.tsx` y la ruta `/admin/crm` actual (el `page.tsx` propio) una vez confirmado que el proxy anda bien en producción.
  - **Nuevas variables en `.env.local` (faltan en Vercel todavía):** `WACRM_API_URL` (`https://forcom-crm.vercel.app/admin/crm`), `WACRM_API_KEY` (key con scopes `contacts:write`+`messages:send`, generada directo en la tabla `api_keys` de wacrm — ver `c:\Apptivando\wacrm\CLAUDE.md` si hay que generar otra).

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
├── proxy.ts                  — auth gate de /admin/* (ver Gotchas críticos)
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
  - **`develop` está muy adelante de `main` mientras dure el Track E** (CRM propio + Evolution API, a medio terminar y con variables `EVOLUTION_*` sin cablear en Vercel). Si hay que llevar un arreglo puntual a producción, **cherry-pick a `main`, no merge de `develop` entero** — un merge desplegaría el Track E incompleto. Así se hizo con el copy de fabricante el 06/08/2026 (`b225b73` en develop → `9567183` en main). Cuando el Track E cierre, las ramas se reconcilian con un merge normal.
- **Vercel:** proyecto `forcom-web` bajo equipo `apptivando`
  - ⚠️ **Se perdió el acceso a esa cuenta de Vercel (06/08/2026).** Todo se está recreando en el scope nuevo `apptivando1`. Checklist: `../MIGRACION_VERCEL.md`. Hasta que se complete, el proyecto viejo sigue sirviendo `forcom.tech` y sigue buildeando en cada push (la GitHub App es una sola para las dos cuentas).
- **Dominios:** `www.forcom.tech` → main · `dev.forcom.tech` → develop
- **DNS:** gestionado en Donweb. Registros de mail (mx1, mail, autoconfig, autodiscover) son de correo externo — no tocar.
  - **Ojo: la zona DNS que muestra Vercel para `forcom.tech` es decorativa.** Los nameservers reales son de Donweb (`ns1/ns2.donweb.com`), así que el comodín `*` que aparece en `vercel dns ls` **no se aplica** — cada subdominio nuevo necesita su registro creado a mano en Donweb.
- **Variables en Vercel:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (`noreply@forcom.tech`), `RESEND_TO_EMAIL` (`ventas@forcom.tech`), `NEXT_PUBLIC_GA_ID`. Las `WACRM_*` quedan obsoletas al apagar el fork de wacrm (06/08/2026).
- **`SUPABASE_SERVICE_KEY` ahora SÍ va a Vercel.** Cambió con el Track E: la usan `admin/actions.ts`, `/admin/miembros` y el webhook de Evolution (`src/lib/supabase/admin.ts` → `createAdminClient()`). Cargarla como *sensitive*. Lo que sigue valiendo es que **nunca** se expone al cliente (nada de prefijo `NEXT_PUBLIC_`).
- **`WACRM_DEPLOYMENT_URL` está partida por entorno (31/07/2026)**, para que el `dev` de la web consuma el `dev` del CRM y no el de producción:
  - **Production** → `https://forcom-crm.vercel.app` (rama `main` del CRM). Es de tipo *sensitive*, o sea que Vercel no la deja leer de vuelta ni por `env pull` — si hay que verificarla, se reescribe con el valor conocido, no se intenta leer.
  - **Preview, acotada a la rama `develop`** → `https://crm-dev.forcom.tech` (rama `develop` del CRM). Cualquier otra rama de preview se queda sin la variable y cae al default hardcodeado de `next.config.ts`, que apunta a producción del CRM.
  - **Se lee en `next.config.ts`, o sea en tiempo de build:** cambiarla en Vercel no hace nada hasta que se redespliega. Si tocás esta variable, redesplegá.
- **`crm-dev.forcom.tech` es del proyecto `forcom-crm`, no de este.** Está asignado a la rama `develop` de ese repo. Funciona como destino del proxy porque la protección de deploys del CRM está en `all_except_custom_domains`: un dominio propio queda fuera del login SSO de Vercel, mientras que el alias `forcom-crm-git-develop-*.vercel.app` sí está protegido y **no** sirve como destino del proxy.

### Gotchas críticos

- **Framework Preset en Vercel** debe ser "Next.js" (no "Other") — si queda en Other, 404 en todas las rutas.
- **`src/lib/supabase/server.ts`** tiene try-catch en `setAll` — requerido porque App Router no permite setear cookies desde Server Components; sin él falla en producción.
- **El "middleware" de Next.js se llama "Proxy" desde la v16, y el archivo TIENE que llamarse `proxy.ts` en la raíz de `src/`** (`src/proxy.ts`) — es la única ubicación que reconoce el framework. Antes vivía en `src/lib/supabase/middleware-proxy.ts`, que **nunca se ejecutaba** (código muerto, nada lo importaba) — `/admin/*` solo estaba protegido por el chequeo de sesión en `admin/(panel)/layout.tsx`, que no corre para rutas reescritas con `rewrites()` (ver más abajo, el proxy del CRM de WhatsApp). Corregido el 30/07/2026. Si se agrega lógica nueva de auth/redirects a nivel de toda la app, va acá, no en un archivo con otro nombre.
- **Logo** usa `next/image` con PNG (`/images/brand/forcom-logo.png`). No volver a SVG con texto — el ® desaparecía y perdía calidad.
- **HeroCarousel usa `h-screen` (no `min-h-screen`)** — con `min-h-screen` la sección se alargaba en algunos slides y la navegación quedaba fuera del viewport. La navegación está posicionada `absolute bottom-6` para que siempre sea visible. No volver a flujo normal ni a `min-h-screen`.
- **Hero mobile layout (30/06/2026)** — `section` usa `items-start md:items-center`: en mobile el contenido arranca justo bajo la navbar (elimina el dead space superior), en desktop queda centrado verticalmente. Imagen: `w-80 h-80` fijo en mobile, `md:w-full md:h-auto md:aspect-square` en desktop. Las decoraciones (esquinas rojas, borde rotado, badge de producto) son visibles en todos los tamaños — no agregar `hidden md:block` a esos elementos. Trust badges: `flex justify-center sm:justify-start text-xs sm:text-sm` (visibles en mobile, centrados). Scroll indicator `sm:hidden` al fondo del texto. Título: `text-center sm:text-left`.
- **Variables de entorno nuevas no se recargan solas en `next dev`** — hay que matar el proceso viejo y arrancar uno nuevo (`.env.local` se lee una sola vez, al arrancar). Si hay más de un `next dev` corriendo (pasó el 30/07/2026 — un proceso viejo quedó vivo en el puerto 3000 y el nuevo cayó al 3001, pero curl seguía pegándole al viejo sin darse cuenta), las pruebas van a ir contra el proceso equivocado sin ningún error visible. Confirmar con `netstat`/`tasklist` que solo hay un proceso antes de probar algo que dependa de env vars recién agregadas.

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
- **Copy de fabricante (06/08/2026):** el subtítulo de "Por qué FORCOM" (`WhyForcom.tsx`) y la `description` del JSON-LD `Organization` (`layout.tsx`) decían "revendedor genérico" / "Distribuidor de hardware POS". Reemplazados por el texto de fábrica (ver "Posicionamiento" arriba). También actualizado en `../FORCOM_preview.html`, que está fuera del repo y por lo tanto no versionado.
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
├── test-extract.mjs        — banco de pruebas del extractor de contactos del scraper de
│                             prospectos. Sin API key ni base de datos.
│                             Casos fijos:   node scripts/test-extract.mjs
│                             Un sitio real: node scripts/test-extract.mjs https://sitio.com.ar
│                             Varios:        node scripts/test-extract.mjs --file urls.txt
│                             Los casos viven en scripts/fixtures/extract-cases.mjs.
│                             ts-resolve-hook.mjs le enseña a node a resolver los imports
│                             del proyecto (extensión implícita y alias `@/`).
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

La `SUPABASE_SERVICE_KEY` la usan estos scripts y, desde el Track E, también el server de la app (ver "Deploy e infraestructura"). Nunca se expone al cliente.

## Artefactos generados

- `../FORCOM_preview.html` — preview standalone del sitio
- `../design-audit/` — screenshots del design review con gstack
- `../FORCOM_Catalogo_1Q_2026.md` — catálogo de 20 productos con specs y tablas
- `../TAREAS_PENDIENTES.md` — listado completo de 95 tareas pendientes (MVP + post-MVP + contenido por producto), listo para importar a Notion
