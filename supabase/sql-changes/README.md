# Cambios de SQL

Cada vez que hay que tocar la base de datos, va un archivo nuevo acá, numerado en orden (`003_...`, `004_...`). Copiar el contenido, pegarlo en Supabase Dashboard → SQL Editor, y correrlo.

`schema.sql` (un nivel arriba) era la referencia completa acumulada (ver abajo: ya no está al día). Esta carpeta es para ir corriendo los cambios de a uno, sin tener que buscar dentro de `schema.sql` cuál es el bloque nuevo.

## Estado al 26/10/2026

Todas las migraciones de esta carpeta están corridas en la base de FORCOM.

- **Siguen vigentes:** 001 (miembros y roles), 015 y 016 (invitaciones y
  contraseñas), 017 (estado `spam`), 018 (insert público del formulario), 021
  (catálogo de Publuu). La 010 dejó la policy de borrado de `contact_messages`,
  que también sigue.
- **Deshechas por la 022:** 002 a 014, 019 y 020 eran del CRM. La 022 borró sus
  tablas y funciones. Quedan acá como registro de lo que se corrió; no volver a
  correrlas.

`schema.sql` quedó atrás de esta carpeta: no tiene las cuentas del panel ni los
cambios del formulario. Para saber cómo está la base hoy, la referencia es esta
carpeta, leída con la lista de arriba.

- **023 (29/10/2026, sin correr todavía):** escritura del sitio y lectura del panel solo para miembros de FORCOM (`current_admin_role()`), no para cualquier usuario logueado — Latin Office comparte el proyecto de Supabase y sus usuarios. Cubre products, hero_content, hero_slides, company_info, contact_messages y los buckets `product-images` y `hero-slides`. Correr primero el paso 0 solo y guardar el listado.
