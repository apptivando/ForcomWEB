@AGENTS.md

# FORCOM Web — Contexto del proyecto

## Qué es esto

Sitio web B2B de presentación y generación de leads para FORCOM, distribuidor de hardware POS en Argentina. Catálogo de 15 productos en 6 categorías (Smart POS, Mini PC, Impresoras, Lectores, Verificadores, Accesorios). Target: supermercados, restaurantes, farmacias, logística, estaciones de servicio, hotelería.

**Stack:** Next.js (App Router) · React 19 · TypeScript · Tailwind CSS 4  
**Fuentes:** Barlow Condensed (display/headings) + DM Sans (body)  
**Dominio previsto:** forcom.com.ar

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

## Estructura de componentes

```
src/
├── app/
│   ├── layout.tsx        — metadata, fuentes Google, favicon
│   ├── page.tsx          — composición de secciones
│   └── globals.css       — variables CSS, animaciones, clases utilitarias
└── components/
    ├── Navbar.tsx         — nav fijo, scroll effect, menú mobile
    ├── Hero.tsx           — headline, CTAs, POS placeholder, trust bar
    ├── ProductCategories.tsx — 6 category cards con hover
    ├── ProductCards.tsx   — 15 productos hardcodeados en 7 grupos
    ├── WhyForcom.tsx      — 6 diferenciadores en grid 3x2
    ├── Industries.tsx     — 6 industrias verticales
    ├── Contact.tsx        — formulario con estado local (no envía aún)
    ├── Footer.tsx         — links, copyright dinámico
    └── ScrollReveal.tsx   — IntersectionObserver para reveal on scroll
```

## Datos hardcodeados

Todos los productos, categorías e industrias viven en arrays dentro de los componentes. Para agregar un producto hay que editar `ProductCards.tsx`. No hay CMS ni base de datos todavía.

## Para correr el proyecto

```bash
cd forcom-web
npm run dev
# → http://localhost:3000
```

## Estado actual (junio 2026)

### Hecho
- Homepage completa con 8 secciones
- Sistema de diseño dark theme industrial coherente
- Animaciones scroll reveal + hover states
- Responsive mobile/tablet/desktop
- Navbar con touch targets de 44px (links y botón CTA)
- Formulario de contacto con validación frontend

### Pendiente para MVP
- Imágenes reales de los 15 productos (todos son placeholders)
- Backend del formulario (`/api/contact` + servicio de email — Brevo o Resend)
- Rutas dinámicas para detalle de producto (`/productos/[categoria]/[modelo]`)
- WhatsApp FAB con número real (+54 11 XXXX-XXXX)
- Analytics (GA4)
- SEO: sitemap.xml, robots.txt, schema markup (Product JSON-LD)
- Favicon con logo FORCOM real
- Deploy en Vercel + configurar dominio forcom.com.ar

### Pendiente post-MVP
- Blog `/blog`
- Páginas de soluciones por industria `/soluciones/[industria]`
- Sistema de cotización / carrito
- Testimonios y logos de clientes

## Convenciones

- Todos los componentes tienen `"use client"` (site interactivo)
- Clases Tailwind 4 — algunas sintaxis difieren de v3, leer docs en `node_modules/next/dist/docs/`
- Colores custom via CSS variables en `globals.css`, Tailwind los expone como `text-forcom-red`, `bg-forcom-card`, etc.
- Sin librerías de animación — todo CSS + IntersectionObserver nativo
- El scroll reveal usa la clase `.reveal` que se activa con `.visible` via JS

## Artefactos generados

- `../FORCOM_preview.html` — preview standalone del sitio (no requiere servidor, abrí en el navegador para compartir con el cliente)
- `../design-audit/` — screenshots del design review con gstack
