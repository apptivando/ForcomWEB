# Historial de cambios — FORCOM Web

Qué se hizo en cada sesión, qué llegó a `develop`, qué llegó a `main` y qué se
probó de verdad. Lo que queda para más adelante va en [Futuro.md](Futuro.md).

## Cómo se usa

**Se escribe una entrada cada vez que algo se pushea a `develop` o a `main`.**
La entrada va arriba de todo (lo más nuevo primero) y tiene siempre estos campos:

```markdown
## AAAA-MM-DD — Título en una línea

**Rama:** develop `abc1234` · **Producción:** no
**Base de datos:** migración 0XX corrida / ninguna
**Qué cambió:** en criollo, para que se entienda dentro de seis meses.
**Probado:** qué se verificó y cómo.
**Sin probar:** lo que quedó sin verificar (si no hay nada, se saca la línea).
```

Dos reglas que hacen que esto sirva:

- **"Probado" es lo que alguien miró funcionando**, no lo que compiló. Que el
  build salga limpio no es una prueba; va en "sin probar" hasta que se use.
- **Si algo se rompió y se arregló, queda escrito el porqué**, no solo el
  arreglo. Es la parte que no se puede reconstruir después.

> Las entradas anteriores al 23/09/2026 se reconstruyeron a partir de los
> transcripts de las sesiones y del historial de git. Son fieles en los hechos,
> pero pueden faltarles detalles que en su momento no se anotaron.

---

## 2026-09-24 — Los errores de las pantallas de contraseña se veían genéricos en producción

**Rama:** develop `7bdd8b1` · **Producción:** no
**Base de datos:** ninguna

**Qué cambió:** **Next borra el mensaje de cualquier error que se tire desde una
Server Action en el build de producción** y lo reemplaza por "An error occurred
in the Server Components render...". En `next dev` el texto se ve, así que el
problema no aparece probando en local: aparece recién en forcom.tech, y le
aparece a la persona. Pasó el 24/09 al reusar una contraseña en
`/admin/recuperar`: en vez de "Esa es la contraseña que ya tenías", cartel
genérico.

Estas pantallas le hablan a alguien que está mirando un formulario, y sus
errores son parte de la conversación. Ahora lo esperable se **devuelve** y solo
lo inesperado se tira. Alcanza a aceptar una invitación, recuperar la
contraseña, cambiarla desde Mi cuenta y pedir el link de recuperación — esta
última tenía el mismo problema con el aviso de dominio de correo caído, que es
lo único que le permite a un admin darse cuenta de que hay algo roto.

**Probado:** `tsc --noEmit` y `eslint` limpios.
**Sin probar:** las cuatro pantallas contra un build de producción, que es donde
se ve la diferencia. Se verifica en el port a `main`.

---

## 2026-09-24 — El menú de productos no funcionaba desde la página de un producto

**Rama:** develop `15b28a1` · main `b0e93d5` (cherry-pick) · **Producción:** sí
**Base de datos:** ninguna

**Qué cambió:** estando en `/productos/[slug]`, elegir otra categoría en el menú
solo agregaba `#cat-...` a la URL y te dejaba en el mismo producto. Los links del
Navbar y del Footer eran anclas sueltas (`#cat-smart-pos`, `#contacto`), que el
navegador busca en la página actual; en la página de producto esas secciones no
existen. Ahora apuntan a la home (`/#cat-smart-pos`), y el logo a `/`. En la home
el comportamiento no cambia (sigue siendo solo scroll).

**Probado:** en producción (`forcom.tech`), el usuario entró a un producto y
navegó a otra categoría desde el menú: funciona correctamente.

---

## 2026-09-24 — La cola de enriquecimiento estaba trabada por el UNIQUE de `phone`

**Rama:** develop `42f7f31` · **Producción:** no
**Base de datos:** ninguna

**Qué cambió:** apretaste "Enriquecer ahora", el cartel informó "5 procesados" y
la cola no bajó. El motor andaba perfecto —encontró 3 correos y 2 WhatsApp en 39
segundos— pero **no guardaba nada**: el `UPDATE` final moría con un `23505` sobre
`crm_contacts_phone_key`.

La causa: las cinco fichas de la cola eran sucursales de cadena (dos "Carrefour
Maxi", dos "Alvear", una "Cordiez") y el enriquecedor les encontraba el **teléfono
central, que ya era de una ficha hermana**. `crm_contacts.phone` tiene `UNIQUE`
desde el esquema original de WhatsApp, donde el teléfono *era* la identidad del
contacto.

**Lo importante no era el teléfono perdido, era el efecto colateral.** Postgres
rechaza el `UPDATE` entero, así que con él se iban también el correo y el WhatsApp
recién encontrados, el `enrichment_status = 'done'` y el `scrape_attempts + 1`.
Sin ese contador el tope de tres intentos nunca se alcanza: la ficha quedaba en
`running`, el watchdog la devolvía a `pending` a los 15 minutos, y se reintentaba
para siempre gastando consultas de Serper en cada vuelta. **Tres semanas
rebotando** — desde el 21/08 y el 25/08, que es cuando se crearon.

El arreglo, en `src/lib/prospects/enrich.ts`, son dos piezas:

- **`phoneTaken()`** — antes de escribir un teléfono nuevo, pregunta si ya es de
  otra ficha. Si lo es, no lo escribe y deja el motivo en las notas. Las fichas
  **no se fusionan**: son dos locales distintos, con direcciones distintas.
- **`saveEnrichment()`** — la red de contención. Ante un `23505` identifica la
  columna que chocó (del `details` de Postgres, o del nombre de la constraint
  como respaldo), la saca del patch y reintenta, para que el estado se guarde
  siempre. Es genérico a propósito: `email` hoy no tiene `UNIQUE` justamente por
  este motivo (nota del índice en la 010), pero el día que alguien le ponga uno,
  la cola no se vuelve a trabar.

De paso, `found.phone` en el resultado del lote ahora informa lo que **se
guardó**, no lo que se encontró: antes el cartel podía prometer cinco teléfonos
con cero escritos.

**El "121" de `Futuro.md` no existía.** Era una nota de agosto ("quedaron ~121
prospectos en la cola cuando se agotó la cuota"), no un número en vivo: la cola
real eran esas 5 fichas rebotando. El ítem se sacó de `Futuro.md`.

**Probado:** se corrió el mismo `enrichBatch()` que usa el botón sobre las 5
fichas trabadas. Antes: los 5 con el error de unicidad y la cola en 5. Después:
**0 errores y la cola en 0**, con los datos verificados campo por campo en la
base — las dos Alvear en tier 1 (`info@alvearsupermercados.com.ar` + WhatsApp),
Cordiez en tier 2 (`clientes@cyre.com.ar`), los dos Carrefour en tier 4 pero con
`done` e `intentos = 1`, o sea fuera de la cola para siempre. Los sitios de
Carrefour no dan datos porque renderizan en JavaScript, que es el límite
documentado del extractor. Vos confirmaste en pantalla "Cola de enriquecimiento:
0". Además: los 19 casos de `test-extract.mjs`, `tsc --noEmit` y `eslint` limpios.

**Sin probar:** el botón en sí, clickeado desde el navegador con el código nuevo
—la verificación se hizo corriendo el mismo código por script—. Nada de esto está
en producción.

La advertencia completa, con el porqué, quedó en
[docs/PROSPECTOS.md](docs/PROSPECTOS.md).

---

## 2026-09-23 — Se arranca el historial y el backlog

**Rama:** develop · **Producción:** no
**Base de datos:** ninguna

**Qué cambió:** se crearon este archivo y [Futuro.md](Futuro.md), y se agregó la
regla de mantenerlos a `CLAUDE.md`. Las entradas anteriores se reconstruyeron a
partir de los transcripts de las nueve sesiones del proyecto (20/07 al 23/09) y
del historial de git.

El motivo: había trabajo planificado en detalle —la agenda de posteos, la cola
de llamadas, las campañas de correo— que solo existía dentro de conversaciones
viejas, y estado probado que solo existía en la memoria de quien lo probó.
Los planes largos quedaron guardados enteros en `Futuro.md`, no resumidos a un
título.

---

## 2026-09-24 — El lead de producción entra sin ficha de cliente

**Rama:** develop `1828600` · **Producción:** no
**Base de datos:** migración **020 corrida** en Supabase

**Qué cambió:** se envió el formulario desde forcom.tech y quedó a la vista una
diferencia entre los dos paneles: el mensaje aparece en los dos, pero en el de
dev la sección Clientes no muestra la ficha de quien escribió.

**No hay nada roto.** Crear la ficha es la fase 7 del Track E y ese código vive
solo en `develop`; producción corre `main`, que guarda el mensaje y nada más.
Los dos paneles leen la misma base, así que el de dev ve un mensaje que entró
por producción y busca una ficha que nadie creó. Cuando `develop` llegue a
`main` esto se arregla solo y para siempre.

Mientras tanto se agregó la migración **020**, que le da ficha a los leads que
no la tienen y los engancha. Es el backfill de la 010 recortado y **repetible**:
se puede correr cada vez que entre un lead antes del merge, sin duplicar ni
pisar datos.

De paso, dos arreglos de andamiaje:

- La **019 no estaba en el array `MIRRORED`** de `scripts/sync-schema.mjs` y su
  contenido estaba copiado a mano en `schema.sql`. Correr ese script —que
  reconstruye el archivo desde la 010— se la habría llevado puesta en silencio.
  Es exactamente el accidente que el `CLAUDE.md` avisa que ya pasó una vez. Se
  la agregó al array, junto con la 020, y para eso hubo que darle a la 019 la
  sección de verificación que le faltaba (el script corta el cuerpo ahí).
- Se puso al día `../MIGRACION_VERCEL.md`: la `SUPABASE_SERVICE_KEY` está
  cargada desde el 07/08 (no se podía deducir desde producción, porque `main` no
  la usa), las siete variables están confirmadas por lo que hace el sitio en
  vivo, el DNS de `crm-dev.forcom.tech` nunca existió, el repo del CRM está
  archivado y los procesos de PM2 parados. El Track 1A queda cerrado.

**Probado:** el envío real desde el sitio, por vos — el lead quedó en la base,
se ve en los dos paneles y el aviso llegó a `ventas@forcom.tech`. Que el lead
está guardado completo y sin ficha se verificó campo por campo contra la base.
Que `schema.sql` no perdió nada al reconstruirse, con un diff línea por línea.
**La 020 corrida y verificada:** 7 mensajes, 7 fichas, `sin_ficha = 0`, y el
lead del 24/09 quedó enganchado a su ficha
(`c5308244-c84f-4913-9dc8-4af14f12b50f`, `origin = formulario`).

**Sin probar:** GA4 tiene el tag en la página en vivo, pero nadie miró el panel
para confirmar que las visitas lleguen. Tampoco se probaron en producción el
login del admin ni `/admin/miembros`.

### Cierre del formulario de contacto

Con esto el tema queda cerrado. El recorrido completo, para que se entienda
dentro de seis meses:

**Qué estaba roto.** El formulario de forcom.tech no guardó una sola consulta
entre el **21/08 y el 23/09/2026**. La persona veía un error, y como el correo
de aviso se manda *después* de guardar, tampoco salía el mail: la consulta
desaparecía sin dejar rastro en ningún lado. Un mes de leads perdidos, y no se
pueden recuperar — el guardado nunca ocurrió y la ruta loguea el error, no el
contenido del mensaje.

**Eran dos causas distintas con el mismo mensaje de error**, y eso fue lo que lo
hizo difícil:

1. En producción faltaba el permiso de escritura pública de la tabla. Lo arregló
   la migración **018**.
2. En `develop` el guardado además pide de vuelta el número del mensaje, y el
   permiso de *lectura* de esa tabla es solo para usuarios logueados. Postgres
   aplica ese permiso a lo que el guardado devuelve, así que fallaba con el
   mismo código (`42501`) y casi el mismo texto. O sea que llevar `develop` a
   producción habría vuelto a romper el formulario, otra vez en silencio.
   Arreglado en `2a808cc`.

**Qué quedó verificado, mirándolo funcionar y no compilando:** el envío real
desde el sitio guarda el lead, lo muestra en los dos paneles y manda el aviso a
`ventas@forcom.tech`; los dos caminos del guardado (con y sin clave de servidor)
probados de punta a punta; y el backfill de fichas corrido y contado.

**Qué queda, y no es del formulario:** llevar `develop` a `main`. Hasta que eso
pase, cada lead nuevo entra sin ficha de cliente y hay que correr la **020** de
nuevo — es repetible justamente para eso. Después del merge se engancha solo y
la 020 deja de tener sentido.

---

## 2026-09-23 — El formulario vuelve a guardar el lead

**Rama:** develop `2a808cc` · **Producción:** no (el arreglo de base sí)
**Base de datos:** migración **018 corrida** en Supabase

**Qué cambió:** el formulario de contacto de forcom.tech llevaba desde el
21/08 sin guardar una sola consulta — un mes entero perdiendo leads, con la
persona viendo un error y sin que saliera el aviso por correo. La migración 018
restauró el permiso de escritura y eso arregló producción.

Pero en `develop` seguía roto por una segunda razón: ahí el guardado pide de
vuelta el número del mensaje (para enganchar la consulta con la ficha del
cliente), y el permiso de lectura de esa tabla es solo para usuarios logueados.
O sea que al llevar `develop` a producción el formulario se habría vuelto a
romper, igual de silencioso. Ahora el mensaje se guarda con la clave de
servidor, y si esa clave no está cargada, se guarda igual sin pedir el número:
se pierde el enlace con la ficha, que se puede recuperar, y no la consulta, que
no.

**Probado:** los dos caminos de punta a punta contra `/api/contact`, y el
comportamiento contra la base real (el mismo guardado entra sin pedir el número
y falla pidiéndolo).

**Sin probar:** **nadie envió el formulario desde el navegador en
www.forcom.tech**. Lo que se verificó es que la base acepta el guardado tal como
lo hace `main` y que el sitio en vivo sigue trayendo datos de Supabase; el envío
real, con el correo de aviso y el auto-reply de Resend, no lo miró nadie todavía
—y Resend no manda un mail desde el 21/08—.
→ **Probado el 24/09/2026**, ver la entrada de arriba: el envío funciona y el
aviso llegó.

---

## 2026-09-21 — Subir archivos descargables en el admin de productos

**Rama:** develop `8558f57` · **Producción:** no
**Base de datos:** ninguna

**Qué cambió:** la sección "Archivos descargables" de la ficha de producto era
un campo donde había que pegar una ruta. Pasó a ser un subidor: se eligen los
archivos del disco (PDF, ZIP, drivers), el nombre que ve el cliente se completa
solo y el tipo (Driver / Folleto / Manual) se adivina por la extensión. Los
archivos van al mismo bucket que las fotos, en una carpeta `files/`. Si el
archivo pasa de 50 MB lo dice en castellano y sugiere subirlo a otro lado.

En la misma sesión se cargó un producto nuevo a partir de su folleto.

**Sin probar:** nadie subió un archivo desde el navegador todavía. Y sacar un
archivo de un producto no lo borra del storage — las fotos ya funcionan igual.

---

## 2026-08-26 — El WhatsApp del formulario llega a la ficha

**Rama:** develop `94f7589` · **Producción:** no
**Base de datos:** migración **019 corrida**

**Qué cambió:** en *Mensajes del formulario* el botón "Responder por WhatsApp"
andaba, pero en la ficha de ese mismo cliente el ícono de WhatsApp estaba
apagado. Las dos pantallas leían el número de lugares distintos. Ahora, si
alguien escribe su número en "Teléfono (WhatsApp)", queda guardado como WhatsApp
confirmado con el origen "lo dejó en el formulario de la web". Si la ficha ya
tenía otro WhatsApp confirmado, no se reemplaza. Estos clientes suben de
Prioridad 3 a Prioridad 1.

**Probado:** el chequeo de tipos pasa y el SQL 019 corrigió los clientes que ya
habían entrado por el formulario.
**Sin probar:** de punta a punta. Falta mandar un formulario con un número y
mirar que en la ficha el ícono verde quede prendido y aparezca "Abrir en la
Bandeja →".

---

## 2026-08-26 — Las páginas de producto llegan a producción

**Rama:** main `4e177ca`
**Base de datos:** ninguna

**Qué cambió:** las fichas de producto con URL propia existían solo en
`develop` desde julio. Se llevaron a producción **con lo que faltaba y habría
roto la función**: el admin de producción no generaba el slug, así que un
producto cargado desde forcom.tech habría quedado enlazando a `/productos/null`.
El síntoma no se veía porque los 18 productos existentes ya tenían slug — habría
aparecido recién con el producto 19. Viajaron también la galería, el sitemap
(tenía **una sola URL**, ahora lista las 18) y el JSON-LD de la home.

**Probado:** sirviendo la rama, no solo compilando. Las 18 fichas responden con
datos reales, un slug inexistente da 404, ningún slug duplicado.
**Sin probar:** quedan 2 errores viejos de lint en el formulario de producto de
`main`. Están arreglados en `develop` y viajan cuando vaya el panel.

---

## 2026-08-25 al 26 — Panel admin: dos auditorías de accesibilidad y legibilidad

**Rama:** develop `3a58ad8`, `82e9fb6` · **Producción:** solo el sitio público
(`57c3f75`)
**Base de datos:** migración **017 corrida** (anti-spam) · la **018 quedó
escrita y sin correr** (ver 23/09)

**Qué cambió, en cuatro bloques:**

- **Que nada se rompa ni se pierda.** Cada sección tiene su pantalla de error y
  el menú sigue visible si algo falla. Si salís de un formulario con cambios sin
  guardar, avisa. Un producto nuevo se crea como borrador y dice qué le falta.
- **Que se pueda ver y tocar.** Rojo accesible, bordes visibles, un modal único
  con cierre por Escape, avisos con "Deshacer", primera columna fija en Clientes.
- **Que el lead avance.** Anti-spam en el formulario, marcar spam en lote, y
  desde cada mensaje responder por mail o WhatsApp y crear una oportunidad.
- **Que sea cómodo.** Menú en cajón para el celular, un título por página,
  buscador y miniaturas en Productos, menú agrupado en Sitio / Ventas /
  WhatsApp / Cuenta.

**Clientes, a pedido:** los contactos pasaron a íconos accionables, uno por
canal (WhatsApp, mail, teléfono, web, redes, Maps), con un color por canal.

**Sitio público:** contraste accesible en el rojo y ningún texto por debajo de
12 px. Esto sí fue a producción.

**Probado:** las 15 secciones del panel con una sesión real, revisando el HTML
servido. Anti-spam contra el endpoint real: los tres casos de bot se descartan
sin avisarle al bot. El detector de productos incompletos marca 2 de 18 con
motivo (el RLS1100 y el 5D Cash Drawer).

---

## 2026-08-25 — El cron de prospectos nunca había corrido

**Rama:** develop `dc247b1`, `157b5a7`, `5e6a88b` · **Producción:** `a74d017`
(solo el workflow, no código de la app)
**Base de datos:** ninguna

**Qué cambió:** GitHub corre los cron **únicamente** desde la rama por defecto,
y el paso que enriquece prospectos vivía solo en `develop`. Nunca se ejecutó.
Se llevó a `main`. Además se midió que GitHub **no respeta el "cada 5 minutos"**:
sobre este repo dispara cada 50-80 minutos. Se decidió no tocar eso y dejar
`drain-queue.mjs` para vaciar la cola a mano.

**El error propio que se corrigió antes de que hiciera daño:** el auditor de
calidad marcaba 35 fichas como sospechosas y **23 eran correctas** — trataba las
sucursales de una cadena como fraude de directorio. Nueve locales de Kilbel
compartiendo `info@kilbel.com.ar` es lo esperable. Y estaban en la rama que
**borra**. Ahora quedan 12 marcadas, de las cuales 4 se borran solas.

**Probado:** la corrida real sobre 320 prospectos. Ver la medición abajo.

---

## 2026-08-24 — Nivel 3 encendido con Serper, y la medición que decidió el rumbo

**Rama:** develop `6367e2e` · **Producción:** no
**Base de datos:** ninguna

**Qué cambió:** Google cerró su API de búsqueda a proyectos nuevos, así que el
nivel 3 —buscar al comercio en el resto de la web cuando no tiene sitio propio—
estaba apagado. Se encendió con Serper y se corrigieron tres bugs que ya estaban
en el código: los bloques `<script>` con JSON se descartaban (y es justo donde
Linktree publica sus links), había áreas telefónicas inexistentes, y el nivel 3
no salía a buscar correo si el prospecto ya tenía WhatsApp.

La primera medición trajo **correos de otras empresas** —de directorios, de un
comercio chileno y de uno mexicano con el mismo nombre— y eso obligó a rediseñar
el nivel 3 con tres pruebas de identidad.

**Probado — y este es el número que cambió el proyecto:**

| Sobre 320 prospectos | Con correo |
|---|---|
| Los 196 que tienen sitio web propio | **86 · 44 %** |
| Los 124 que no tienen sitio | **8 · 6 %** |

Los correos salen casi exclusivamente del sitio propio del comercio. El nivel 3
trae bien WhatsApp y redes, que no es lo que se buscaba. Costó USD 0,52.
**Conclusión: para la campaña de mail conviene buscar rubros donde los comercios
tengan sitio web** (distribuidoras, mayoristas, cadenas), no ferreterías de
barrio. La decisión de seguir o parar quedó abierta — ver Futuro.md.

---

## 2026-08-22 al 24 — Invitaciones, contraseñas y recuperación

**Rama:** develop `0adc881`, `26a594a`, `7f92100`, `8148e91`, `4a398f3`
**Producción:** no
**Base de datos:** migraciones **015 y 016 corridas**

**Qué cambió:** el correo de invitación lo mandaba Supabase, en inglés, con su
diseño y con un link de un solo uso que **se quemaba cuando el antivirus de la
casilla corporativa lo abría antes de entregarlo** — por eso llegaban vencidos.
Ahora la invitación la manda la app, en español y con marca FORCOM, y abrir el
link no consume nada: se marca usado recién cuando llega la contraseña nueva.
Mismo mecanismo para "olvidé mi contraseña", que antes no existía (había que
pedirle a un admin que te invitara de nuevo).

Después, tres cosas que aparecieron probándolo: cartel visible al guardar,
rechazar la contraseña que ya se tenía, y que los gestores de contraseñas
ofrezcan **generar** una en vez de mostrar las guardadas.

**Probado:** llegó el correo y el link llevó a donde corresponde.
**Sin probar:** los tres arreglos del final quedaron sin re-probar.

---

## 2026-08-19 al 21 — Track E, fases 7 a 10: clientes unificados, scraper y CRM

**Rama:** develop `4972a1a` … `841f43a` (11 commits) · **Producción:** no
**Base de datos:** migraciones **010, 011, 012, 013 y 014 corridas**

**Qué cambió:**

- **Clientes unificados.** `crm_contacts` dejó de ser "los contactos de
  WhatsApp" y pasó a ser la tabla única de clientes: entran también los
  prospectos del scraper y los leads del formulario, diferenciados por origen.
- **Buscador de prospectos** por rubro y localidad sobre Google Places, con
  enriquecimiento desde el sitio web de cada comercio y orden por prioridad de
  contacto (1 WhatsApp · 2 email · 3 teléfono · 4 sin contacto).
- **Contacto en frío** con plantillas y tope diario, modeladas desde ya con los
  campos que pide Meta, para no rehacerlo al migrar a Cloud API.
- **Ficha de cliente como panel lateral** con línea de tiempo que mezcla notas,
  mensajes y cambios de etapa del pipeline.
- **Líneas de WhatsApp de los vendedores** (registro de lo que se habló desde el
  celular, sin operarlas desde la plataforma) y **análisis de conversaciones**:
  lo que se calcula sin IA (quién preguntó y nadie contestó, cuánto tarda cada
  uno) separado de lo que sí la necesita.

**Probado:** la ficha de cliente, punto por punto, con el usuario mirando. La
primera corrida real del buscador dio 8 de 20 con WhatsApp confirmado
("ferreterías en Córdoba Capital").
**Sin probar:** nunca se conectó una línea real de vendedor ni se mandó un
mensaje de verdad. Las `EVOLUTION_*` siguen sin cargar en Vercel.

> **El 21/08 el cliente cambió el rumbo y todo el WhatsApp se congeló.** No se
> borró ni se desarmó: sigue funcionando como está, pero no recibe más trabajo.
> La prioridad pasó a conseguir teléfonos y correos para llamar y mailear.

---

## 2026-08-11 — Textos del Hero y carga de slides al admin

**Rama:** develop · **Producción:** no
**Base de datos:** ninguna

**Qué cambió:** el cliente objetó "reduce las colas" del Hero por ambiguo. Se
generaron alternativas orientadas al chequeo de precio y se cargaron al
`/admin/hero` los slides que hasta entonces estaban escritos en el código, para
que se puedan editar sin tocar el repo.

---

## 2026-08-12 — El workflow del cron llega a main

**Rama:** main `45ad63d` — ver el 25/08, donde recién se descubrió que el paso
que importaba no estaba incluido.

---

## 2026-08-06 — FORCOM es fábrica, no revendedor

**Rama:** main `9567183`

**Qué cambió:** decisión del cliente sobre el posicionamiento. Ningún texto del
sitio puede describir a FORCOM como revendedora, distribuidora o importadora.
Aplica también a metadata, JSON-LD y textos del admin.

---

## 2026-07-20 al 08-11 — Agenda de posteos con IA: solo planificación

**Rama:** ninguna · **No se escribió código.**

Se planificó tres veces una sección nueva del panel para armar la agenda de
redes conversando con una IA, con calendario de fechas patrias y comerciales.
Se descartaron Postiz y Mixpost por ser stacks pesados que no se integran a un
admin Next.js liviano. Quedó pendiente rearmar el plan poniendo UploadPost antes
que Seedance, y ahí se detuvo.

**El plan completo está rescatado en [Futuro.md](Futuro.md)** para que no se
pierda.
