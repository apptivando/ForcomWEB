# Buscador de prospectos y pantalla de Clientes

Cómo funciona, cómo se configura y cómo se corre el scraper de prospectos de
FORCOM. Fases 7 y 8 del Track E.

---

## Qué hace

Escribís un **rubro** y una **localidad**, y la herramienta trae los comercios
que Google Maps conoce en esa zona. Después, sola, va completando lo que Google
no da — email, WhatsApp, redes sociales — visitando el sitio de cada comercio y,
si hace falta, buscando en Google.

Todos los resultados aterrizan en **`/admin/clientes`**, junto a los contactos
que llegaron por WhatsApp y a los leads del formulario web, diferenciados por
una etiqueta de origen y ordenados por prioridad de contacto:

| Prioridad | Significa | Cómo se llega |
|---|---|---|
| **1** | WhatsApp confirmado | Un enlace `wa.me` en el sitio, un número junto a la palabra "WhatsApp", o carga manual |
| **2** | Email | Del sitio, de un directorio, o del formulario web |
| **3** | Solo teléfono | Lo que publica Google Maps |
| **4** | Sin contacto | Queda marcado para reintentar y para resolver a mano |

El WhatsApp **solo se marca con evidencia**. Nunca se le pregunta a Evolution si
un número tiene WhatsApp: se descartó por el riesgo de que WhatsApp limite la
línea. Cuando el teléfono de Google viene marcado como celular (`+54 9`), la
ficha lo muestra con un `?` gris — es información, no una confirmación, y no
cambia la prioridad.

---

## Configuración

### Variables de entorno

| Variable | Para qué | Obligatoria |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | Buscar comercios en Google Maps | Sí (o el modo de prueba) |
| `GOOGLE_PLACES_MOCK` | `1` = usa 25 comercios de ejemplo en vez de llamar a Google | No |
| `GOOGLE_CSE_API_KEY` | Nivel 3: buscar en Google | No — sin ella el nivel 3 se apaga |
| `GOOGLE_CSE_CX` | ID del buscador de Programmable Search | No |
| `PROSPECT_SEARCH_DAILY_LIMIT` | Tope diario de consultas del nivel 3 (default `90`) | No |
| `PROSPECT_USER_AGENT` | Cómo se presenta el bot ante los sitios que visita | No (hay default) |
| `PROSPECTS_WHATSAPP_CHECK` | `off`. El gancho de verificación por Evolution, apagado | No |
| `CRON_SECRET` | Protege el endpoint del cron. Ya existía | Sí, para el cron |

> Después de tocar `.env.local` hay que reiniciar `npm run dev`: se lee una sola
> vez, al arrancar.

### Google Cloud

1. Crear un proyecto y habilitar **Places API (New)** — la "New", no la legacy.
2. Crear una API key y restringirla a esa API. Activar facturación y poner una
   alerta de presupuesto.
3. Para el nivel 3: habilitar **Custom Search API** y crear un buscador en
   [programmablesearchengine.google.com](https://programmablesearchengine.google.com).

**Importante sobre el buscador**: Google eliminó la opción "buscar en toda la
web" para motores nuevos el **20/01/2026** (los que ya la tenían la conservan
hasta el 01/01/2027). Un motor creado hoy solo puede buscar en hasta **50
dominios**. Hay que cargarlos a mano; la lista sugerida está más abajo.

También: **búsqueda de imágenes desactivada** (no la usamos) y **SafeSearch
desactivado** (filtraría prospectos legítimos por falsos positivos, y como los
resultados los procesa el código y no los ve nadie, no protege de nada).

### Costos

- **Places Text Search**: se factura por página, no por resultado. Una búsqueda
  de 60 prospectos son 3 llamadas. Cae en el SKU *Enterprise* (USD 28,00 / 1.000
  requests en el tramo 0-100k) porque el FieldMask incluye teléfono y sitio web,
  que son justamente el producto. **No agregar campos al FieldMask "por las
  dudas"**: agregar no encarece mientras no se pase de Enterprise, pero sacar
  abarata.
- **Custom Search**: 100 consultas por día gratis, después USD 5 cada 1.000. El
  tope diario configurable lo deja dentro de lo gratuito.

### Base de datos

Correr `supabase/sql-changes/010_clientes_unificados.sql` en Supabase Dashboard →
SQL Editor. Requiere que `001` y `002` ya estén corridas. El archivo termina con
tres consultas de verificación.

---

## Cómo se usa

1. Entrar a **`/admin/clientes`** y abrir el panel **Buscar prospectos**.
2. Cargar rubro y localidad. Opcionalmente elegir un tipo de negocio (acota el
   ruido) y cuántos traer (menos = más barato: cada 20 son una llamada).
3. Apretar **Buscar**. Los resultados aparecen en segundos, ya etiquetados como
   origen "Búsqueda".
4. El enriquecimiento sigue solo. Si hay apuro, **Enriquecer ahora** procesa un
   lote chico al instante.

**Google devuelve como máximo 60 resultados por búsqueda** — es un techo duro de
la API, no una elección. Para cubrir una ciudad grande conviene repetir por
barrio; los repetidos se fusionan solos por `google_place_id`, no se duplican.

---

## La cascada de enriquecimiento

```
Nivel 0  Google Places        → nombre, dirección, teléfono, sitio, rating
   ↓  (si ya hay email y WhatsApp, corta)
Nivel 1  Sitio web propio     → home + hasta 3 páginas · email, WA, redes
   ↓  (si no hay sitio, o el sitio no dio nada)
Nivel 2  Redes enlazadas      → NO se visitan. Solo se guarda la URL.
   ↓
Nivel 3  Google Search        → snippets + hasta 2 directorios
   ↓
Nivel 4  Sin contacto         → queda para resolver a mano
```

### Nivel 1 — el sitio del comercio

Home más hasta 3 páginas elegidas por puntaje (`/contacto` rinde más que
`/nosotros`). Máximo 4 páginas y ~20 segundos por sitio, con **1,5 segundos de
espera entre pedidos al mismo host** (o el `Crawl-delay` del robots.txt si es
mayor). Se corta apenas hay email + WhatsApp.

Se respeta `robots.txt` con la regla de "gana la coincidencia de path más
larga". Ante la duda **no se entra**: si el archivo no se puede leer por timeout
o error del servidor, se asume prohibido. Un 404 sí significa permitido.

### Nivel 2 — por qué las redes no se scrapean

Facebook, Instagram y LinkedIn exigen login y sus términos lo prohíben
expresamente. Cualquier scraper de esas redes se rompe en semanas o termina con
la IP bloqueada. Lo que sí se hace es **guardar el link del perfil**, que es lo
único accionable que le queda a un prospecto sin datos: un vendedor abre el
Instagram y saca el WhatsApp de la bio en diez segundos.

Caso frecuente en Argentina: el "sitio web" que publica Google **es** un
Instagram. Se detecta antes de intentar crawlearlo, se guarda como perfil, y el
prospecto salta directo al nivel 3.

### Nivel 3 — búsqueda en Google

Tres consultas por prospecto, cortando apenas alcanza:

1. `"<teléfono>"` — búsqueda inversa. La que más rinde para el email, y la que
   *mejor* funciona restringida a directorios.
2. `"<razón social>" <localidad>` — encuentra el perfil de red y la ficha de
   directorio aunque no estén enlazados.
3. La misma con `(whatsapp OR contacto)`, solo si la anterior trajo ruido.

**Lo más valioso: no hace falta visitar nada.** El `snippet` que devuelve la API
—el resumen que Google muestra debajo de cada resultado— muy seguido ya trae el
teléfono, el email, o la biografía de un perfil de Instagram, que es donde los
comercios argentinos ponen su WhatsApp. Leer el índice de Google no es scrapear
Instagram: es la vuelta legal al hecho de que las redes no se pueden visitar.

Solo si el resumen no alcanza se abren hasta 2 resultados, y **nunca una red
social** — solo directorios.

Se aplica **únicamente a prospectos que quedaron en prioridad 3 o 4**. Nunca a
todos: es lo que mantiene el costo dentro de lo gratuito.

#### Los 50 dominios del buscador

**Directorios comerciales argentinos** — donde vive el email que el comercio no
publica y donde funciona la búsqueda inversa:

```
*.paginasamarillas.com.ar/*   *.cylex.com.ar/*      *.guialocal.com.ar/*
*.infoisinfo.com.ar/*         *.opendi.com.ar/*     *.tuugo.com.ar/*
*.hotfrog.com.ar/*            *.yalwa.com.ar/*      *.dateas.com/*
```

**Redes sociales** — solo para leer el resumen que Google ya indexó:

```
*.instagram.com/*   *.facebook.com/*   *.linkedin.com/*
*.linktr.ee/*       *.beacons.ai/*     *.bio.link/*
```

**Plataformas donde los comercios chicos arman su web** — recupera buena parte
de lo que se perdió al no poder buscar en toda la web:

```
*.mitiendanube.com/*   *.business.site/*   *.wixsite.com/*
*.sites.google.com/*   *.negocio.site/*    *.mercadolibre.com.ar/*
```

Quedan ~30 libres. **La lista se ajusta con evidencia**: cuando un prospecto se
resuelve, conviene anotar de qué dominio salió el dato y agregar los que rinden.

### Nivel 4 — carga manual

Botón **Editar** en la fila. Lo que se guarda ahí queda con `manual_lock`: a
partir de ese momento **ningún proceso automático vuelve a tocar esa ficha**, ni
el enriquecedor ni el merge de una búsqueda futura.

---

## El proceso automático

`GET /api/cron/prospects`, protegido con `Authorization: Bearer $CRON_SECRET`.
Lo dispara el workflow `.github/workflows/automations-cron.yml` cada 5 minutos,
el mismo que ya corría las automatizaciones.

- Lote de 6 prospectos por corrida (`?limit=` lo cambia, tope 25).
- Reclamo atómico con `FOR UPDATE SKIP LOCKED`: dos corridas solapadas no
  visitan los mismos sitios.
- Watchdog: lo que quedó en `running` hace más de 15 minutos (por un deploy a
  mitad de lote, o un timeout) vuelve solo a la cola.
- Presupuesto propio de 240 segundos, más corto que el límite de la función,
  para no morir en medio de un `UPDATE`.

Correrlo a mano: pestaña **Actions** de GitHub → *Automations cron* → *Run
workflow*.

---

## Probar sin API key

Ocho de las diez piezas se prueban sin tocar Google.

**Extractor de contactos** — es donde más se itera:

```bash
node scripts/test-extract.mjs                        # 17 casos fijos
node scripts/test-extract.mjs https://sitio.com.ar   # un sitio real
node scripts/test-extract.mjs --file urls.txt        # varios, uno por línea
```

Los casos fijos están en `scripts/fixtures/extract-cases.mjs` y cubren lo que
rompe de verdad: el CUIT en el pie de página, el mail escondido por Cloudflare,
`logo@2x.png`, el botón de compartir de Facebook, el link de grupo de WhatsApp.
**Los casos que esperan `null` importan tanto como los positivos**: el riesgo del
extractor no es no encontrar, es inventar.

**Búsqueda completa** — poner `GOOGLE_PLACES_MOCK=1` en `.env.local`. Devuelve 25
comercios de ejemplo armados para ejercitar los casos borde: fijos y celulares
mezclados, comercios sin teléfono, un "sitio web" que es un Instagram, dos
sucursales con el mismo teléfono (para probar que el merge fusione en vez de
reventar) y un local cerrado definitivamente.

---

## Los dos nombres

Cada ficha tiene **`business_name`** (razón social) y **`contact_name`** (la
persona). Los escriben fuentes distintas y **nunca se pisan**:

| Campo | Lo escribe |
|---|---|
| `business_name` | Google Places · campo "empresa" del formulario · edición manual |
| `contact_name` | El `pushName` de WhatsApp · campo "nombre" del formulario · edición manual |

Sin esta separación, el primer mensaje de WhatsApp convertiría "Farmacia del
Sol" en "Juan". En la UI se muestra `business_name ?? contact_name ?? teléfono`,
con el otro debajo en gris.

---

## Advertencias

**Caché de 30 días de Google.** Los términos de Places obligan a borrar o
refrescar su contenido a los 30 días; el `place_id` está exento. La columna
`google_synced_at` registra cuándo se trajo. Lo que sacamos del **sitio propio
del comercio** (email, WhatsApp, redes) **no es contenido de Google** y
sobrevive: un prospecto enriquecido queda válido indefinidamente. Es un
argumento más para enriquecer rápido.

**Atribución.** Los términos exigen "Powered by Google" al mostrar datos de
Places sin un mapa, incluso puertas adentro. Está al pie de `/admin/clientes`.

**`contact_tier` es de solo lectura.** Es una columna `GENERATED ALWAYS AS ...
STORED`. Cualquier insert o update que la incluya revienta con *"cannot insert a
non-DEFAULT value into column"*. Nunca hacer `select('*')` → `upsert(row)` sobre
`crm_contacts`.

**Sitios hechos en JavaScript.** Las cadenas grandes (Disco, Easy, Grido)
renderizan todo del lado del cliente y su HTML inicial no tiene datos de
contacto: el extractor no va a sacar nada de ahí. No es un bug — es el límite de
leer HTML sin ejecutar JavaScript, y meter un navegador headless al proyecto no
se justifica. Los prospectos reales de FORCOM son comercios chicos, cuyos sitios
sí traen el contacto en el HTML.

**Lo que se aprendió probando.** Los primeros teléfonos que sacaba de sitios
grandes eran inventados: salían de **hashes hexadecimales** como
`6ef3802991029e2744…`, donde una corrida de 10 dígitos válidos queda rodeada de
letras hex y pasaba los lookarounds. Por eso los límites de la regex de teléfono
son `[A-Za-z0-9]` y no `\d`, y por eso se saca el ruido numérico (URLs, UUIDs,
hashes) antes de buscar. Si alguien "simplifica" eso, vuelven los teléfonos
fantasma.
