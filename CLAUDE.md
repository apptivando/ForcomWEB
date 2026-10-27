@AGENTS.md

# FORCOM Web — Contexto del proyecto

## Qué es esto

Sitio web B2B de presentación y generación de leads para FORCOM, fabricante de hardware POS en Argentina. Catálogo de 15 productos en 6 categorías (Smart POS, Mini PC, Impresoras, Lectores, Verificadores, Accesorios). Target: supermercados, restaurantes, farmacias, logística, estaciones de servicio, hotelería.

**Posicionamiento (definido por el cliente, 06/08/2026): FORCOM es fábrica, no revendedor ni distribuidor.** Ningún texto del sitio debe describirla como revendedora, distribuidora o importadora. El argumento a usar es el que habilita fabricar: adaptar el equipo a la operación del cliente, sostener repuestos en el tiempo y dar garantía directa sin depender de una marca ajena. Aplica también a metadata, JSON-LD y textos del admin.

**Stack:** Next.js (App Router) · React 19 · TypeScript · Tailwind CSS 4  
**Fuentes:** Barlow Condensed (display/headings) + DM Sans (body)  
**Dominio:** forcom.tech (en producción)

## CRM: no vive en este repo

**El CRM es un producto aparte: Apptivando CRM** (`c:ApptivandoApptivandoCRM`,
`crm.apptivando.com`), con su propia base. FORCOM es una organización cliente
de ese producto. Si aparece un pedido de CRM —clientes, prospección, pipeline,
WhatsApp, plantillas, campañas, llamadas—, va ahí, no acá. Leer su `CLAUDE.md`
primero.

Lo que queda acá es el sitio público y el panel de contenido: Hero, Productos,
Catálogo, Info empresa, **Mensajes del formulario** (`/admin/crm`, la bandeja de
leads del sitio: no es parte del CRM y no se apaga) y Cuentas/Miembros.

Historia corta, por si hace falta:
- 30/07–06/08/2026: se probó un fork de wacrm detrás de un proxy en
  `/admin/crm/*`. Se discontinuó.
- 06/08–24/09/2026: se construyó un CRM propio dentro de este repo (Track E):
  bandeja de WhatsApp con Evolution API, asistente de IA, pipeline,
  automatizaciones, buscador y enriquecedor de prospectos, análisis de
  vendedores.
- 24/09/2026: se mudó a Apptivando CRM y quedó congelado en `develop`.
- 26/10/2026: se dio de baja del todo. Las mejoras que no eran del CRM pasaron
  a `main`, las 21 tablas se borraron de la base (migración 022) y `develop`
  quedó igual a `main`. **El código completo del CRM está en la etiqueta
  `crm-congelado-2026-10-26`** (`git show crm-congelado-2026-10-26:<ruta>`),
  con sus docs `docs/PROSPECTOS.md` y `docs/WHATSAPP.md`. Los datos están
  respaldados fuera del repo en `../respaldo_crm_2026-10-26/`.

Lección que sigue valiendo, del teléfono argentino (`src/lib/phone.ts`): no
intentar detectar el viejo prefijo local "15". Con la costumbre actual (área +
número, sin 0 ni 15) el "15" aparece por coincidencia en el borde entre área y
número y rompía números reales. Ante la duda, `null`: falla segura.

## Reglas de trabajo

### Cómo armar un plan

Todo plan que le presente al usuario debe tener esta estructura, en este orden:

1. **Cómo funcionaría** — explicar en términos simples el funcionamiento resultante, sin jerga de implementación.
2. **Tareas del usuario** — qué tiene que hacer el usuario (ej. crear o modificar tablas/políticas en Supabase, cargar variables de entorno, crear cuentas de terceros), como pasos concretos y accionables.
3. **Tareas propias** — qué voy a hacer yo; acá sí mostrar los cambios de archivos y código (diffs, snippets, nombres de archivo).

### Al terminar una tarea

Verificar que el build salga limpio (`npm run build`) antes de dar la tarea por terminada. Si el build sale limpio, hacer push: a `develop` si esa rama existe en el repo, si no, directo a `main`.

**Con cada push, escribir la entrada en `History.md`** (arriba de todo, formato en su encabezado): qué rama, qué commit, si llegó a producción, qué migración se corrió, qué cambió, qué se probó y qué quedó sin probar. "Probado" es lo que alguien vio funcionando — que el build salga limpio no cuenta.

**Lo que se posterga se escribe en `Futuro.md` antes de cerrar la sesión**, con el motivo y etiquetado `[vos]` o `[yo]`. Cuando un ítem de `Futuro.md` se empieza, se saca de ahí y pasa a `History.md` al pushear.

## Decisión de plataforma

Se comenzó con un plan en WordPress (ver `../PLANCMS.md`) pero se migró a Next.js. El PLANCMS.md es un documento desactualizado — ignorarlo.

## Sistema de diseño

```
--black:       #0D0D0F   (fondo principal)
--dark:        #141416   (fondo secciones alternas)
--card:        #1A1A1E   (fondo tarjetas)
--border:      #2A2A2E   (bordes)
--red:         #E8231A   (acento primario, superficies grandes, logo)
--red-dark:    #C41D16   (fondo de botón sólido — ver abajo)
--red-text:    #FF6A5C   (texto rojo chico sobre oscuro — ver abajo)
--gray:        #8A8A8A   (texto secundario)
--gray-light:  #B0B0B0   (texto links nav, subtítulos)
```

**Los dos rojos accesibles no son decorativos: son la corrección de un fallo de
contraste medido** (auditoría UX del 20/08/2026, aplicada el 25-26/08). El
`#E8231A` de marca queda por debajo de AA en dos usos concretos, midiendo sobre
los colores efectivamente renderizados y componiendo las transparencias:

- texto blanco sobre botón `#E8231A` → **4,48:1** (mínimo 4,5:1)
- texto `#E8231A` chico sobre fondos oscuros → **3,74–3,82:1**

Por eso: **botón sólido va `bg-[#C41D16]` con `hover:bg-[#E8231A]`** (5,9:1 con
blanco) y **texto rojo chico va `#FF6A5C`** (5,8–6,2:1). El rojo de marca sigue
siendo el de las barras, los puntos y las superficies grandes, donde no hay
texto encima. Los tokens están en `globals.css` con las mediciones al lado.

Border-radius: `rounded-sm` (2px) en todo el sitio — look industrial, no bubbly.
Sin librerías de animación — todo CSS + IntersectionObserver nativo.
Sin librerías de UI (no shadcn, no MUI) — componentes propios con Tailwind.

### Componentes compartidos del panel

Existen para que un mismo concepto no se implemente de cinco formas distintas.
**Antes de escribir un overlay, un aviso, un interruptor o una etiqueta nueva,
usar el que ya está**:

| Componente | Para qué | Por qué existe |
|---|---|---|
| `admin/Modal.tsx` | Diálogo modal | Los overlays a mano no cerraban con Escape, no tenían `role="dialog"` y el fondo scrolleaba. Trae Escape, trampa de foco, bloqueo de scroll y retorno del foco. |
| `admin/Toast.tsx` | Avisos de "esto pasó" + **Deshacer** | Crear y borrar no confirmaban nada. El deshacer **pospone** la acción en vez de revertirla: el borrado sale al servidor cuando expira el aviso. |
| `admin/Toggle.tsx` | Interruptor on/off | Estaba copiado en cinco lugares. **Encendido va en verde**: el rojo queda para lo destructivo. |
| `admin/Field.tsx` | Campo con etiqueta asociada | Había 37 `<label>` y ninguno asociado. Envuelve el control, así no hay que inventar ids. |
| `admin/AdminErrorScreen.tsx` | Pantalla de error de sección | Se renderiza **dentro** del layout, así el menú sobrevive al error. |
| `lib/admin/sections.ts` | Nombre único de cada sección | Menú, encabezado y `<title>` decían cosas distintas. El menú **ya no tiene labels propios**: los toma de acá. |
| `lib/hooks/useUnsavedChanges.ts` | Guard de cambios sin guardar | El App Router no tiene bloqueo de navegación oficial; intercepta el clic en el `<a>` en fase de captura. |
| `lib/products/completeness.ts` | Qué le falta a un producto | Ojo con la regex: `TODO` va **sensible a mayúsculas**, si no matchea "todo en uno" y hasta dentro de "Método". |

## Estructura de componentes

```
src/
├── proxy.ts                  — auth gate de /admin/* (ver Gotchas críticos)
├── app/
│   ├── layout.tsx            — metadata, fuentes Google, favicon
│   ├── page.tsx              — composición de secciones (server component)
│   ├── globals.css           — variables CSS, animaciones, clases utilitarias
│   └── admin/
│       ├── actions.ts        — server actions: hero, productos, mensajes, miembros
│       └── (panel)/          — rutas protegidas del admin
│           ├── dashboard/    — stats
│           ├── hero/         — editor de slides del hero carousel
│           ├── productos/    — CRUD de productos
│           ├── empresa/      — datos de contacto (WhatsApp, email, etc.)
│           ├── catalogo/     — link del catálogo de Publuu
│           ├── miembros/     — invitar, roles, quitar (solo owner/admin)
│           ├── cuenta/       — cambiar la propia contraseña
│           └── crm/          — mensajes del formulario (spam, borrar en lote, responder)
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

**`contact_messages`** — mensajes del formulario de contacto. `phone` (solo dígitos, opcional) y `status` en `nuevo | leido | contactado | spam` (017). Insert público para anon sin `.select()` (ver Gotchas).

**`admin_members`, `admin_invitations`, `admin_password_resets`** — cuentas del panel (migraciones 001, 015, 016). Ver `docs/ACCESOS.md`.

Los cambios a la base desde agosto están en `supabase/sql-changes/`, numerados. `schema.sql` no está al día con ellos. Las 002 a 014, 019 y 020 eran del CRM y la 022 las deshizo.

### Tablas nuevas: `GRANT` explícito

Desde el 2026-10-30 Supabase ya no da acceso automático de la Data API a las tablas
nuevas de `public` (sin `GRANT`, supabase-js recibe `permission denied`). Todo
`CREATE TABLE` nuevo en `supabase/sql-changes/` lleva en el mismo archivo:

```sql
grant select, insert, update, delete on public.nueva_tabla to authenticated;
grant select, insert, update, delete on public.nueva_tabla to service_role;
```

A `anon` solo si el sitio público la lee o escribe sin sesión (ej. catálogo), y con el
permiso justo (`grant select`). El `GRANT` habilita el acceso; RLS lo sigue recortando.

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
  - **`develop` y `main` quedaron iguales el 26/10/2026.** Lo normal es trabajar en `develop` y pasar a `main` con cherry-pick desde un worktree (ver la skill de prácticas). Si algún día vuelven a separarse mucho, no hacer merge de `develop` entero sin revisar qué arrastra.
- **Vercel:** proyecto `forcom-web` bajo equipo `apptivando`
  - ⚠️ **Se perdió el acceso a esa cuenta de Vercel (06/08/2026).** Todo se está recreando en el scope nuevo `apptivando1`. Checklist: `../MIGRACION_VERCEL.md`. Hasta que se complete, el proyecto viejo sigue sirviendo `forcom.tech` y sigue buildeando en cada push (la GitHub App es una sola para las dos cuentas).
- **Dominios:** `www.forcom.tech` → main · `dev.forcom.tech` → develop
- **DNS:** gestionado en Donweb. Registros de mail (mx1, mail, autoconfig, autodiscover) son de correo externo — no tocar.
  - **Ojo: la zona DNS que muestra Vercel para `forcom.tech` es decorativa.** Los nameservers reales son de Donweb (`ns1/ns2.donweb.com`), así que el comodín `*` que aparece en `vercel dns ls` **no se aplica** — cada subdominio nuevo necesita su registro creado a mano en Donweb.
- **Variables en Vercel:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (`noreply@forcom.tech`), `RESEND_TO_EMAIL` (`ventas@forcom.tech`), `NEXT_PUBLIC_GA_ID`, `SUPABASE_SERVICE_KEY`. Si quedan `WACRM_*`, `EVOLUTION_*`, `SERPER_*`, `GOOGLE_PLACES_*` o `GOOGLE_CSE_*` cargadas, son del CRM y se pueden borrar.
- **`SUPABASE_SERVICE_KEY` va a Vercel, como *sensitive*.** La usan las acciones de miembros, invitaciones y contraseñas (`src/lib/supabase/admin.ts` → `createAdminClient()`). **Nunca** se expone al cliente (nada de prefijo `NEXT_PUBLIC_`).

### Gotchas críticos

- **Un `.insert().select()` con la clave anon necesita policy de SELECT, y da el mismo error que si faltara la de INSERT.** Postgres aplica la policy de SELECT a la cláusula `RETURNING`, y PostgREST usa `RETURNING` para devolver la fila insertada. Con policy de INSERT pública y SELECT solo para autenticados —justo lo que tiene `contact_messages`— el insert anon entra si no se pide nada de vuelta y falla con `42501: new row violates row-level security policy` si se le pide el id. **Es el mismo código y casi el mismo mensaje que el bug de la migración 018, con otra causa: en la 018 la policy de INSERT no estaba; acá está y sobra.** Verificado contra la base real el 23/09/2026 (los dos inserts, uno al lado del otro). Por eso `/api/contact` inserta con el cliente anon y **sin** `.select()`: no necesita el id. Abrir el SELECT al rol anon dejaría leer el buzón entero desde cualquier navegador. Si aparece un 42501 en una tabla con envío público, mirar primero si el insert pide datos de vuelta.
- **Los cron de GitHub Actions solo se disparan desde `main`.** Un workflow con `schedule` corre **únicamente** desde la rama por defecto, sin importar en cuál lo estés editando. Hoy no hay ninguno: el que había (`automations-cron.yml`) era del CRM y se borró el 26/10/2026.
- **Framework Preset en Vercel** debe ser "Next.js" (no "Other") — si queda en Other, 404 en todas las rutas.
- **`src/lib/supabase/server.ts`** tiene try-catch en `setAll` — requerido porque App Router no permite setear cookies desde Server Components; sin él falla en producción.
- **El "middleware" de Next.js se llama "Proxy" desde la v16, y el archivo TIENE que llamarse `proxy.ts` en la raíz de `src/`** (`src/proxy.ts`) — es la única ubicación que reconoce el framework. Antes vivía en `src/lib/supabase/middleware-proxy.ts`, que **nunca se ejecutaba** (código muerto, nada lo importaba) — `/admin/*` solo estaba protegido por el chequeo de sesión en `admin/(panel)/layout.tsx`. Corregido el 30/07/2026. Si se agrega lógica nueva de auth/redirects a nivel de toda la app, va acá, no en un archivo con otro nombre.
- **Logo** usa `next/image` con PNG (`/images/brand/forcom-logo.png`). No volver a SVG con texto — el ® desaparecía y perdía calidad.
- **HeroCarousel usa `h-screen` (no `min-h-screen`)** — con `min-h-screen` la sección se alargaba en algunos slides y la navegación quedaba fuera del viewport. La navegación está posicionada `absolute bottom-6` para que siempre sea visible. No volver a flujo normal ni a `min-h-screen`.
- **Hero mobile layout (30/06/2026)** — `section` usa `items-start md:items-center`: en mobile el contenido arranca justo bajo la navbar (elimina el dead space superior), en desktop queda centrado verticalmente. Imagen: `w-80 h-80` fijo en mobile, `md:w-full md:h-auto md:aspect-square` en desktop. Las decoraciones (esquinas rojas, borde rotado, badge de producto) son visibles en todos los tamaños — no agregar `hidden md:block` a esos elementos. Trust badges: `flex justify-center sm:justify-start text-xs sm:text-sm` (visibles en mobile, centrados). Scroll indicator `sm:hidden` al fondo del texto. Título: `text-center sm:text-left`.
- **Las invitaciones al panel NO usan el mail de Supabase (22/08/2026)** — `inviteUserByEmail` manda su propio correo en inglés y con un token de un solo uso que **se consume con un GET**: los antivirus de las casillas corporativas abren los links antes de entregar el mail y lo queman, así que la invitación le llega vencida a quien la recibe (pasó con `emilio.reula@centroficina.com.ar`, `last_sign_in_at` 24 segundos después de mandarla). Ahora el token lo emite la app y abrir el link no consume nada — ver `docs/ACCESOS.md`. Lo mismo vale para el "olvidé mi contraseña" (`/admin/recuperar`, 24/08/2026). No volver a `inviteUserByEmail` ni a mandar links que ejecuten la acción con un GET.
- **Las rutas de `/admin` que se ven sin sesión hay que declararlas en `src/proxy.ts`** (`isPublicAdminRoute`: login, join, recuperar). Una pantalla nueva de acceso que no se agregue ahí redirige al login y no se puede usar nunca.
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
- Formulario de contacto activo: guarda en `contact_messages` + notificación interna + auto-reply al cliente vía Resend. Anti-spam con campo trampa y tiempo mínimo (`src/lib/antispam`).
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
├── preview-email.mjs       — vista previa de los correos del panel, sin mandar nada.
│                             node scripts/preview-email.mjs --text
│                             Escribe .preview-email.html (ignorado por git). --resent muestra
│                             la invitación reenviada y --reset el correo de recuperación
│                             de contraseña. Ver docs/ACCESOS.md.
├── ts-resolve-hook.mjs     — le enseña a node a resolver los imports del proyecto
│                             (extensión implícita y alias `@/`). Lo usa preview-email.
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

La `SUPABASE_SERVICE_KEY` la usan estos scripts y también el server de la app (ver "Deploy e infraestructura"). Nunca se expone al cliente.

## Artefactos generados

- `../FORCOM_preview.html` — preview standalone del sitio
- `../design-audit/` — screenshots del design review con gstack
- `../FORCOM_Catalogo_1Q_2026.md` — catálogo de 20 productos con specs y tablas
- `../TAREAS_PENDIENTES.md` — listado completo de 95 tareas pendientes (MVP + post-MVP + contenido por producto), listo para importar a Notion
