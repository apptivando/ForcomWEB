# Buscador de prospectos y pantalla de Clientes

Cómo funciona, cómo se configura y cómo se corre el scraper de prospectos de
FORCOM. Fases 7 y 8 del Track E.

---

## Qué hace

Escribís un **rubro** y una **localidad**, y la herramienta trae los comercios
que Google Maps conoce en esa zona. Después, sola, va completando lo que Google
no da — email, WhatsApp, redes sociales — visitando el sitio de cada comercio.

### Resultados medidos

Primera corrida real, "ferreterías en Córdoba Capital", 20 prospectos:

| | |
|---|---|
| Con WhatsApp confirmado | **8** (7 por enlace `wa.me`, 1 por texto) |
| Con email | 11 |
| Con perfil de Instagram o Facebook guardado | 10 |
| Con sitio web publicado en Google | 14 |
| Sin ningún dato de contacto | 0 |

Los 9 que quedaron en prioridad 3 (solo el teléfono de Google) son casi todos
comercios **sin sitio web**: son justamente los que resolvería el nivel 3, que
hoy está apagado porque Google cerró su API de búsqueda (ver esa sección).

Repetir la misma búsqueda dio **0 nuevos y 20 fusionados** — no duplica.

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
| `PROSPECT_SEARCH_PROVIDER` | Nivel 3: `off` \| `google` \| `serper` \| `brave` | No — default `off` |
| `SERPER_API_KEY` / `BRAVE_SEARCH_API_KEY` | Credencial del proveedor de búsqueda elegido | Solo si el nivel 3 está encendido |
| `GOOGLE_CSE_API_KEY` / `GOOGLE_CSE_CX` | Nivel 3 vía Google. **Ya no sirve para proyectos nuevos** (ver abajo) | No |
| `PROSPECT_SEARCH_DAILY_LIMIT` | Tope diario de consultas del nivel 3 (default `90`) | No |
| `PROSPECT_USER_AGENT` | Cómo se presenta el bot ante los sitios que visita | No (hay default) |
| `PROSPECTS_WHATSAPP_CHECK` | `off`. El gancho de verificación por Evolution, apagado | No |
| `WHATSAPP_TRANSPORT` | `evolution` (actual) o `meta` (Cloud API oficial) | No — default `evolution` |
| `OUTREACH_DAILY_LIMIT` | Tope de mensajes en frío por día (default `20`) | No |
| `CRON_SECRET` | Protege el endpoint del cron. Ya existía | Sí, para el cron |

> Después de tocar `.env.local` hay que reiniciar `npm run dev`: se lee una sola
> vez, al arrancar.

### Google Cloud

1. Crear un proyecto y habilitar **Places API (New)** — la "New", no la legacy.
2. Crear una API key y restringirla a esa API. Activar facturación y poner una
   alerta de presupuesto.

Eso es todo lo que hace falta. El nivel 3 **no se puede hacer con Google**; ver
la sección correspondiente.

### Costos

- **Places Text Search**: se factura por página, no por resultado. Una búsqueda
  de 60 prospectos son 3 llamadas. Cae en el SKU *Enterprise* (USD 28,00 / 1.000
  requests en el tramo 0-100k) porque el FieldMask incluye teléfono y sitio web,
  que son justamente el producto. **No agregar campos al FieldMask "por las
  dudas"**: agregar no encarece mientras no se pase de Enterprise, pero sacar
  abarata.
- **Nivel 3**: hoy apagado y sin costo. Si se enciende, depende del proveedor
  (ver esa sección). El tope diario acota el gasto en cualquier caso.

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
Nivel 3  Búsqueda web         → APAGADO (Google cerró su API a proyectos
   ↓                            nuevos; se puede encender con otro proveedor)
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
Instagram. Se detecta antes de intentar crawlearlo y se guarda como perfil (con
el nivel 3 encendido, además saltaría a él).

### Nivel 3 — búsqueda en la web

**Hoy está apagado.** No por decisión de diseño: Google cerró la puerta en dos
tiempos.

1. **20/01/2026** — eliminó la opción "buscar en toda la web" de Programmable
   Search para motores nuevos (los que ya la tenían la conservan hasta el
   01/01/2027). Se rediseñó para trabajar con un motor restringido a 50 dominios
   elegidos a mano, que para la búsqueda inversa por teléfono incluso funciona
   mejor: los directorios comerciales son exactamente donde vive un teléfono
   indexado.
2. **Al probarlo con la key real** — 403 `PERMISSION_DENIED`, *"This project does
   not have the access to Custom Search JSON API"*. Google **cerró la API entera
   a clientes nuevos**. No es un problema de configuración, de permisos de la key
   ni de propagación: los proyectos creados ahora no tienen acceso y no lo van a
   tener. El reemplazo que Google ofrece es Vertex AI Search, un producto
   empresarial desproporcionado para esto.

Los niveles 0, 1, 2 y 4 funcionan enteros sin esto. Lo que se pierde son los
prospectos que **no tienen sitio web**: hoy quedan en prioridad 3 (solo el
teléfono de Google Maps) y hay que trabajarlos a mano.

#### Cómo encenderlo

`src/lib/prospects/search.ts` expone una sola función, `webSearch()`, y el
proveedor se elige por variable de entorno. Aguas arriba nada cambia.

| `PROSPECT_SEARCH_PROVIDER` | Credencial | Notas |
|---|---|---|
| `off` | — | Default. Nivel 3 apagado. |
| `serper` | `SERPER_API_KEY` | serper.dev. 2.500 consultas gratis por única vez, después crédito prepago con vencimiento a 6 meses. Devuelve toda la web y trae el panel lateral de Google, que para un comercio local suele tener el teléfono ya separado. |
| `brave` | `BRAVE_SEARCH_API_KEY` | Brave Search API. Discontinuó su plan gratuito en febrero de 2026; hoy cobra por consulta. Devuelve toda la web. |
| `google` | `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_CX` | Solo sirve en proyectos que ya tenían acceso antes del cierre. |

Serper y Brave son APIs oficiales de esos proveedores, no scraping. **Verificar
las tarifas vigentes antes de contratar**: este mercado cambió dos veces en seis
meses.

Si el proveedor devuelve un error permanente (como el 403 de Google), el nivel 3
se apaga solo para el resto de la corrida en vez de gastar tres llamadas
condenadas a fallar por cada prospecto.

#### Qué haría, cuando esté encendido

Tres consultas por prospecto, cortando apenas alcanza:

1. `"<teléfono>"` — búsqueda inversa. La que más rinde para el email: encuentra
   en qué directorios comerciales está listado ese teléfono, y esos directorios
   publican datos que el comercio no pone en ningún otro lado.
2. `"<razón social>" <localidad>` — encuentra el perfil de red y la ficha de
   directorio aunque no estén enlazados en ningún lado.
3. La misma con `(whatsapp OR contacto)`, solo si la anterior trajo ruido.

**Lo más valioso: no hace falta visitar nada.** El resumen que devuelve la API
—lo que se muestra debajo de cada resultado— muy seguido ya trae el teléfono, el
email, o la biografía de un perfil de Instagram, que es donde los comercios
argentinos ponen su WhatsApp. Leer el índice de un buscador no es scrapear
Instagram: es la vuelta legal al hecho de que las redes no se pueden visitar.

Solo si el resumen no alcanza se abren hasta 2 resultados, y **nunca una red
social** — solo directorios (`paginasamarillas.com.ar`, `cylex.com.ar`,
`guialocal.com.ar`, `infoisinfo.com.ar`, `opendi.com.ar`, `tuugo.com.ar`,
`hotfrog.com.ar`, `yalwa.com.ar`, `dateas.com`).

Se aplica **únicamente a prospectos que quedaron en prioridad 3 o 4**. Nunca a
todos: es lo que mantiene el costo acotado.


### Nivel 4 — carga manual

Botón **Editar** en la fila. Lo que se guarda ahí queda con `manual_lock`: a
partir de ese momento **ningún proceso automático vuelve a tocar esa ficha**, ni
el enriquecedor ni el merge de una búsqueda futura.

---

## La ficha del cliente

Click en cualquier fila de Clientes y se abre un **panel lateral a la derecha**,
con la lista visible y usable a la izquierda. Click en otra fila y cambia de
cliente sin cerrarse; con las flechas del encabezado se salta al siguiente o al
anterior. Se cierra con Escape, la X, o el botón "atrás" del navegador.

Tres pestañas:

- **Resumen** — todo lo que sabemos, incluidos los campos que antes no se veían
  en ningún lado: dirección, LinkedIn, cuándo se trajeron los datos de Google,
  hasta dónde llegó la búsqueda automática y, si falló, **por qué** — ese texto
  antes solo existía como globito al pasar el mouse. También el bloque del
  Pipeline: se puede crear una oportunidad o moverla de etapa sin ir a la otra
  pantalla.
- **Actividad** — una sola lista cronológica que mezcla, sin importar el canal:
  WhatsApp, mensajes del formulario web, movimientos de oportunidades, de qué
  búsqueda salió el prospecto y las notas internas del equipo. Cada uno edita
  sus notas; owner y admin, todas.
- **Datos** — el formulario de edición, con todos los campos. Acá también está
  eliminar el cliente.

### Dos decisiones de diseño que no son obvias

**La ficha no pasa por el router de Next.** `?cliente=<id>` se maneja con
`history.pushState`, no con `router.replace`. Si pasara por el router, cada
apertura y cada salto re-ejecutaría las siete consultas de la página —incluida
la de facetas, que lee hasta 5.000 filas—. Abrir una ficha no puede costar eso.
El efecto secundario bueno: "atrás" cierra la ficha y el link directo funciona.

**No hay click-fuera para cerrar** en escritorio. Sería incompatible con dejar
la lista usable: cada click en una fila significaría a la vez "abrir esta ficha"
y "cerrar el panel". En pantallas chicas, donde el panel tapa la lista entera,
sí hay velo que cierra al tocarlo.

### El candado, ahora con salida

Antes, corregir cualquier dato congelaba la ficha **para siempre**: la búsqueda
automática no la volvía a tocar y no había forma de descongelarla. Ahora:

- **Congela** editar un campo que un proceso automático también escribe.
- **No congela** editar los demás.
- Y hay un botón **"Descongelar y volver a buscar"** que la devuelve a la cola.

El motivo del candado no es que te sobrescriban un dato —el enriquecedor solo
completa lo que está vacío— sino que si **borrás** un dato equivocado, sin
candado la próxima corrida lo vuelve a poner.

Las notas de una persona ya no comparten campo con las del robot:
`crm_contacts.notes` queda como bloc del enriquecedor y las notas del equipo
viven en `crm_events`, con autor y fecha.

## Escribirle a un prospecto

Botón **Escribir** en la fila del cliente. No abre nada ahí: crea la
conversación y **te lleva a la Bandeja**, al hilo de ese cliente.

**Todo el envío vive en la Bandeja.** Antes había dos lugares desde donde
mandar mensajes —el panel de la fila y el composer del hilo— y solo uno de los
dos miraba la ventana de 24 h y el tope diario. Ahora es uno solo.

En el pie del hilo, arriba del cuadro de escribir, la Bandeja dice en qué
situación estás y te ofrece únicamente lo que corresponde:

- **Ventana abierta** (el cliente escribió hace menos de 24 h): el cuadro de
  texto libre de siempre, con las respuestas rápidas.
- **Ventana cerrada, o nunca escribió**: el cuadro se reemplaza por el selector
  de plantillas, con la vista previa ya completada con los datos del cliente y
  el contador de mensajes en frío del día al lado.

Esconder el cuadro de texto cuando no se puede usar es más honesto que dejarlo
ahí para que el envío falle después. Al costado siempre está **Abrir en mi
WhatsApp**, el link `wa.me` que sale desde tu número y no desde el del CRM.

La Bandeja también acepta `?c=<id>` en la URL, así un hilo puntual se puede
compartir por link.

### La ventana de 24 horas

Es la regla que ordena toda esta parte. Con una conexión oficial de Meta se
puede mandar **texto libre solo dentro de las 24 horas posteriores al último
mensaje del cliente**. Fuera de esa ventana —o sea, en todo primer contacto—
Meta únicamente acepta plantillas que haya aprobado antes.

Hoy el transporte es Evolution, que al no ser oficial no aplica esa regla. Igual
la ventana se calcula y se muestra en el panel, por dos motivos: avisa cuándo se
está haciendo algo que Meta no permitiría, y hace que el día que se conecte la
cuenta oficial no cambie nada más que el transporte. Con
`WHATSAPP_TRANSPORT=meta`, un texto libre fuera de la ventana se rechaza antes
de salir a la red, con un mensaje entendible en vez de un error de API.

Las plantillas se cargan en **`/admin/plantillas`**, con los campos que pide
Meta (nombre, idioma, categoría y estado de aprobación). Los marcadores son
`{{1}}`, `{{2}}`… igual que allá, y se completan solos desde la ficha cuando la
descripción de la variable menciona *nombre de contacto*, *razón social*,
*rubro* o *localidad*. Si el dato falta, el marcador queda vacío: nunca se le
muestra un `{{1}}` crudo a un cliente.

### El tope diario

Mandar mensajes no solicitados desde el número de la empresa es exactamente el
patrón que hace que WhatsApp limite o bloquee una línea. `OUTREACH_DAILY_LIMIT`
(20 por defecto) es el freno. Conviene arrancar bajo y subirlo despacio.

El cupo **solo lo consume el contacto en frío**: contestar dentro de la ventana
de 24 h no descuenta, porque no es prospección sino atender a alguien que
escribió. La reserva del cupo es atómica y ocurre *antes* de enviar; si el envío
falla, el cupo se devuelve.

Cada ficha guarda `outreach_at` y `outreach_count`, así que se ve de un vistazo
a quién ya se le escribió y no se le insiste al mismo prospecto en cada tanda.
Los mensajes quedan marcados con `is_outreach` y con la plantilla que se usó,
para poder medir después qué porcentaje contesta y con cuál.

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

## Verificar que todo esté en pie

```bash
node scripts/verify-prospects.mjs          # esquema, funciones, datos (no escribe)
node scripts/verify-prospects.mjs --live   # además prueba las APIs de Google
```

Chequea que la migración 010 esté corrida, que las columnas y funciones existan
y respondan, y que las credenciales sirvan. Cada fallo dice qué hacer.

## Prueba de punta a punta

```bash
node scripts/e2e-prospects.mjs "ferreterías" "Córdoba Capital" --max 20 --enrich 6
```

Hace lo mismo que el botón **Buscar** y después corre un lote de
enriquecimiento, mostrando qué encontró cada prospecto. **Escribe en la base de
verdad** — es el punto. Cuesta una llamada a Places por cada 20 resultados.

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
