# Futuro — FORCOM Web

Todo lo que se decidió dejar para más adelante: planes completos que nunca se
empezaron, decisiones pendientes y deuda chica. Lo que ya se hizo va en
[History.md](History.md).

## Cómo se usa

- **Cuando algo se posterga, se escribe acá antes de cerrar la sesión**, con el
  motivo. Un ítem sin motivo no sirve: dentro de tres meses nadie se acuerda si
  se frenó por plata, por una decisión del cliente o porque no andaba.
- **Cada ítem dice quién lo destraba:** **[vos]** o **[yo]**.
- **Cuando algo se empieza, se saca de acá y se anota en History.md** al
  pushear.
- Los planes largos se guardan enteros, no resumidos a un título. El trabajo de
  planificar ya está pago; perderlo obliga a hacerlo dos veces.

> ## 🛑 Desde el 24/09/2026, casi nada de este archivo se hace acá
>
> **El CRM se mudó a Apptivando CRM** (`c:\Apptivando\ApptivandoCRM`). Todo lo
> que sea clientes, prospección, pipeline, bandeja, llamadas o campañas de
> correo **se planifica y se construye allá**, no en este repo. Lo que sigue
> guardado abajo es el trabajo de análisis ya hecho — sirve como insumo para el
> proyecto nuevo, que arranca con esas decisiones tomadas en vez de
> redescubrirlas.
>
> **Lo que sí queda para este repo** es el sitio público y el panel de
> contenido: la sección 2.1 (agenda de posteos), la 5 (sitio y contenido) y la
> 6 (infraestructura), más la deuda chica de la sección 4.

**Orden actual de prioridad en este repo:** terminar de llevar el panel a
producción y el contenido del sitio. La prospección y el contacto por teléfono
y correo pasan a Apptivando CRM.

---

# 1. Decisiones tuyas que destraban trabajo

| # | Decisión | Por qué está frenada |
|---|---|---|
| 1 | **[vos]** ¿Se lleva a `main` el port de Cuentas y Miembros? | Está armado y verificado (24/09), esperando tu visto bueno. Es lo único que falta para que cada persona entre con su propia contraseña en producción en vez de compartir una. Ver `History.md`, 24/09. |
| 2 | **[vos]** ¿Qué se hace con el resto del panel rediseñado? | Las secciones de contenido (Hero, Productos, Info empresa) siguen solo en `develop` desde el 26/08. **Tiene un costo mientras se espera:** cada lead que entra por el formulario queda sin ficha de cliente hasta que se corra la migración **020** a mano. Ya no se puede mergear `develop` entero: arrastraría el CRM congelado. Va por port, como el de Cuentas. |
| 3 | **[vos]** ¿Cuándo y cómo se engancha Apptivando CRM? | Está previsto embeberlo en un iframe desde un subdominio propio de FORCOM, con su marca. Hasta que eso pase, las secciones de Ventas y WhatsApp de `develop` quedan congeladas. La decisión y el plan son del otro repo. |

> **Las decisiones que estaban acá sobre el scraper** —seguir o no con el nivel
> 3, qué rubros buscar, qué servicio de telefonía usar— **se mudaron a
> Apptivando CRM** junto con el producto. La medición que las informa (44 % de
> correos en comercios con sitio propio contra 6 % en los que no tienen) está en
> `History.md`, 24/08.

---

# 2. Planificado en detalle y sin empezar

## 2.1 Agenda de posteos con IA para redes

> Planificado el 20/07/2026, revisado tres veces, última revisión pedida el
> 11/08. **Nunca se escribió código.** No existen `/admin/agenda` ni
> `/admin/fechas-importantes`.

### Cómo funcionaría

Una sección nueva del panel, partida en dos: a la izquierda un **chat con una
IA**, a la derecha un **calendario** con vista por semana o por mes. Se le habla
como a una persona: "armá la agenda de la semana que viene con estos productos y
esta temática", "tengo estas fotos de una instalación, armemos posteos para
mostrarla", "cambiame el texto del jueves, muy formal".

Los posteos aparecen como **borradores** en el calendario: texto, hashtags,
fecha, red (Facebook o Instagram) y tipo (post, historia o reel). Si el posteo
necesita una imagen y no hay foto real que sirva, la IA entrega el **texto de un
prompt** para generarla en otra herramienta; el archivo generado se sube al mismo
posteo y queda todo junto. **La herramienta no publica nada** — eso se hace a
mano, como hasta ahora.

La IA tiene en cuenta un **calendario editable de fechas importantes** (feriados
nacionales y fechas comerciales: Día del Niño, Hot Sale, Día de la Madre, Black
Friday) y sugiere posteos alrededor de esas fechas aunque no se lo pidan.

### Decisiones ya tomadas (no reabrir)

1. Solo Meta (Facebook + Instagram) — coincide con lo que ya usan para Ads.
2. **Sin publicación automática** en esta etapa.
3. IA: Claude (Anthropic API), vía chat, no un formulario de un disparo.
4. El calendario de fechas importantes entra desde la fase 1.
5. Sin motor de generación de imagen conectado: la IA da el prompt, el usuario
   genera afuera y sube el resultado.
6. Calendario con vista semana **y** mes.
7. Se descartaron Postiz y Mixpost: stacks pesados y separados
   (NestJS+Postgres+Redis+Temporal, o Laravel+Vue) que no se integran a un admin
   Next.js liviano, y ninguno resuelve el pedido central.

### Tareas tuyas

- **[vos]** Crear la API key en [console.anthropic.com](https://console.anthropic.com)
  y confirmar que la cuenta tenga facturación. El costo es de centavos por
  sesión de chat.
- **[vos]** Cargar `ANTHROPIC_API_KEY` en `.env.local` y en Vercel (secret,
  Production y Preview, sin prefijo `NEXT_PUBLIC_`).
- **[vos]** Correr el SQL en Supabase (tablas `social_posts`, `important_dates`,
  `agenda_chat_messages`, sus políticas y el bucket `social-media`).
- **[vos]** Revisar el seed de fechas importantes. Los feriados móviles y las
  fechas comerciales que cambian cada año necesitan ajuste anual desde la
  pantalla.

### Fases

| Fase | Qué incluye |
|---|---|
| **1 — CRUD + calendario, sin IA** | Tablas, tipos, `actions-agenda.ts`, pantalla de agenda con calendario semana/mes y form manual, CRUD de fechas importantes, entradas en el menú. Ya es usable a mano. |
| **2 — Chat con IA** | `@anthropic-ai/sdk`, `api/agenda/chat/route.ts` con *tool use* (`create_draft_posts`), panel de chat integrado. |
| **3 — Pulido** | Sección de medios (copiar prompt + subir resultado), resaltar en el calendario los posts recién creados, botón rápido aprobado→publicado. |

### Apéndice técnico

- **Tool use estándar, no salida JSON forzada** — así el modelo puede preguntar
  y proponer, y solo "escribe" en el calendario cuando llama a la herramienta.
- **`media_id` referencia una imagen candidata por ID, nunca una URL libre**, para
  que la IA no pueda inventar una imagen que no existe. Si no hay ninguna que
  sirva, llena `media_prompt`.
- Modelo por defecto `claude-sonnet-5`, `thinking` desactivado explícitamente
  (en Sonnet 5 corre adaptativo si se omite) para costo y latencia predecibles.
- Hay que generalizar `ImageGalleryEditor.tsx`: hoy tiene el bucket
  (`product-images`) y el prefijo (`products/`) escritos a mano. Se agregan como
  props opcionales con esos mismos valores por defecto, así `ProductForm.tsx` no
  cambia.
- Archivos críticos: `supabase/schema.sql`, `src/app/admin/actions-agenda.ts`,
  `src/app/api/agenda/chat/route.ts`, `src/components/admin/AgendaChatPanel.tsx`,
  `src/components/admin/AgendaCalendar.tsx`, `src/components/admin/AdminSidebar.tsx`.

### Lo que quedó explícitamente fuera

- **Publicar directo en Meta.** Requiere App Review y verificación de negocio;
  el trámite puede tardar semanas y no depende de nosotros.
- **Motor de generación de imagen/video.** No se eligió proveedor.
- **UploadPost** (publicar vía un tercero) — quedó como fase posterior al MVP.
- **Seedance** (video/imagen) — quedó como fase posterior a UploadPost.
- **Canva** — se preguntó si convenía generar la imagen ahí y publicar por
  ellos; quedó sin resolver.
- **Google Business Profile.** Investigado: necesita ubicación física verificada
  (correo postal 5-10 días o video 3-5 días) y el acceso a la API es un trámite
  aparte con aprobación manual de Google, que pide un perfil activo hace 60+
  días. Viable a mediano plazo porque FORCOM tiene local, pero con esfuerzo y
  demoras comparables a Meta. Lo relevante sería Local Posts API (publicar),
  Business Information API (horarios especiales por feriado) y Reviews API.

> **Pendiente concreto:** el 11/08 se pidió rearmar el plan reordenando las
> fases para que **UploadPost venga antes que Seedance**. Esa versión nunca se
> escribió.

---

## 2.2 La cola de llamadas

> **➜ Se mudó a Apptivando CRM (24/09/2026). No se construye en este repo.**
> Queda acá porque el análisis ya está hecho y le sirve al proyecto nuevo tal
> cual — sobre todo la obligación del Registro "No Llame", que tiene demora
> administrativa y conviene arrancar igual.
>
> Fase 2 del plan del 21/08/2026. Nunca se empezó.

### Cómo funcionaría

Los prospectos que quedaron con **solo teléfono** (prioridad 3) dejan de ser una
lista muerta y pasan a ser trabajo asignado. Cada vendedor entra a su pantalla y
ve a quién le toca llamar hoy: el teléfono para marcar, la ficha del cliente al
lado, y un solo paso para registrar cómo salió — atendió, no atendió, número
equivocado, no le interesa, interesado, volver a llamar tal día. Lo que registre
queda en la línea de tiempo del cliente.

**"Interesado" crea la oportunidad** en el Pipeline en un paso. La asignación
sola **no** la crea: si no, el tablero se llena de quinientas tarjetas de gente a
la que nadie llamó todavía y deja de servir.

### La obligación legal que no es opcional

El **Registro Nacional "No Llame" (Ley 26.951)** prohíbe llamar con fines
publicitarios a quien esté inscripto, y obliga a **consultar el registro antes de
llamar y a re-chequearlo cada 30 días**. Los números inscriptos se marcan, **no
aparecen en la cola** y no se pueden asignar, sin que nadie tenga que acordarse.
La pantalla avisa cuándo se importó la lista por última vez y se pone en rojo
pasados los 30 días.

### Tareas tuyas — tienen demora administrativa, conviene arrancarlas ya

- **[vos]** Inscribir la base en el **Registro Nacional de Bases de Datos
  Personales** de la AAIP y después pedir las **credenciales de consulta del
  registro "No Llame"**. Es gratuito. Consultas: `datospersonales@aaip.gob.ar`.
  Sin esas credenciales no se puede bajar la lista, y llamar a un número
  inscripto es una infracción con multa.
- **[vos]** Decir qué vendedores reciben la cola y confirmar que cada uno tenga
  su usuario en el admin.

### Tareas mías

1. Migración: asignación de cliente a vendedor, registro de llamadas y lista de
   "No Llame".
2. Asignar prospectos a un vendedor, de a uno o en tanda, desde Clientes
   filtrado por prioridad 3.
3. Pantalla `/admin/llamadas` — un vendedor ve solo los suyos; un admin, todos.
4. Registrar el resultado, con "volver a llamar" con fecha.
5. "Interesado" crea la oportunidad en el Pipeline.
6. Las llamadas entran en la línea de tiempo del cliente.
7. Importación de la lista de la AAIP y bloqueo en la cola.
8. El aviso de los 30 días.

### Por qué una tabla propia de llamadas y no un tipo de nota

- **La cola necesita preguntar "¿a quién llamo hoy?"**, que es una consulta por
  fecha de próximo intento. Guardado dentro de una nota, no se puede consultar.
- **Los permisos son distintos.** Hoy, desde el navegador, lo único que se puede
  crear en la línea de tiempo son notas, a propósito, para que nadie fabrique
  eventos del sistema. Meter las llamadas ahí obliga a aflojar esa regla.
- **Es donde va a colgar el servicio de terceros.** La grabación y la
  transcripción quieren su propio campo.

---

## 2.3 Las campañas de correo con EnvíaloSimple

> **➜ Se mudó a Apptivando CRM (24/09/2026). No se construye en este repo.**
> La advertencia del SPF de abajo **sigue siendo de acá**: el DNS que se toca es
> el de `forcom.tech`, y hacerlo mal rompe todo el correo del dominio, incluido
> el de las invitaciones al panel.
>
> Fase 3 del plan del 21/08/2026. Nunca se empezó.

### Cómo funcionaría

Los clientes con correo salen en una **exportación lista para EnvíaloSimple**
(la herramienta de email marketing de DonWeb) para subirla a mano. Cuando haya
cuenta paga, la misma información viaja sola por la API: sincroniza los contactos
hacia una lista y trae de vuelta quién abrió, quién hizo clic, **quién rebotó y
quién se dio de baja**. Eso último es lo que importa: un correo que rebotó o
alguien que pidió no recibir más **no se vuelve a exportar nunca**, y se ve en su
ficha.

### La obligación legal

Toda comunicación publicitaria por correo en Argentina tiene que llevar la
palabra **"PUBLICIDAD"** en el encabezado, decir de forma destacada cómo pedir la
baja, y transcribir el artículo de la ley que da ese derecho. Va en la plantilla,
no librado a que alguien se acuerde.

### Tareas tuyas

- **[vos]** Cuenta en EnvíaloSimple. Para subir el CSV a mano alcanza la básica;
  **la API solo existe en los planes pagos**.
- **[vos]** ⚠️ **Autenticar el dominio (SPF y DKIM) con cuidado.** El DNS de
  `forcom.tech` está en DonWeb y ya tiene registros de correo externo. Un dominio
  admite **un solo registro SPF**: si se agrega un segundo, se rompen los dos y
  empieza a rebotar *todo* el correo, incluido el que hoy funciona. Lo correcto
  es agregar el `include` de EnvíaloSimple **dentro del SPF que ya existe**.
  Conviene que lo revise antes de tocarlo.
- **[vos]** Aprobar el texto legal y confirmar que la dirección de baja sea una
  que alguien lea de verdad.

### Tareas mías

1. Exportación con el formato que importa EnvíaloSimple, aparte del CSV actual.
2. Solo se exporta a quien corresponde: con correo, que no haya rebotado, que no
   se haya dado de baja.
3. El texto legal en un solo lugar, para que no se pueda armar una campaña sin él.
4. Adaptador de la API detrás de `ENVIALOSIMPLE_API_KEY`, apagado por defecto.
5. El estado del correo en la ficha: en lista · abrió · hizo clic · rebotó · se
   dio de baja, con fecha.
6. Sincronización periódica de rebotes y bajas, colgada del cron que ya corre.
7. Documentar en `docs/CORREO.md`.

> **Ojo:** EnvíaloSimple son **dos productos distintos con dos APIs distintas**.
> El que sirve acá es **EnvíaloSimple Marketing** (campañas a listas, con
> métricas, bajas y automatizaciones), no el transaccional.

---

## 2.4 Paso B del nivel 3 — guardar todo lo que encuentra

> **➜ Se mudó a Apptivando CRM (24/09/2026). No se construye en este repo.**
>
> Estaba condicionado a que la medición del Paso A lo justificara. **Dio 6 % en
> comercios sin sitio web, así que la decisión quedó abierta** (ver sección 1).

Hoy, de cada página, el enriquecedor se queda con **un** correo y **un** teléfono
y tira el resto, aunque el sitio publique `info@` y `ventas@`. Y cuando la
búsqueda no resuelve nada, tira también los resultados: el "sin contacto" queda
como una ficha en blanco en vez de una lista de diez enlaces donde el dato
probablemente esté.

1. **[vos]** Correr la migración (canales alternativos + resultados de búsqueda).
2. **[yo]** Guardar todos los correos y teléfonos encontrados, con su puntaje y
   de dónde salieron. El principal sigue siendo el mismo.
3. **[yo]** "Usar este" y "descartar" en la ficha. Lo descartado **no vuelve** en
   la próxima corrida.
4. **[yo]** Mostrar en la ficha lo que encontró la búsqueda, para los que
   quedaron sin datos.
5. **[yo]** Actualizar `docs/PROSPECTOS.md`.

**El orden de prioridad de los clientes no se toca.** Los canales alternativos
son suplentes: no escriben en la ficha solos, así que la columna de prioridad
—que la calcula la base— no se mueve sola. Promover uno es una acción explícita
de una persona, y ahí sí se recalcula.

---

# 3. Congelado en `develop` (no se borra, no se toca)

**Desde el 24/09/2026 está congelado todo el CRM**, no solo el WhatsApp: los
grupos **Ventas** (`/admin/clientes`, `/admin/pipelines`) y **WhatsApp**
(`/admin/inbox`, `/admin/lineas`, `/admin/plantillas`, `/admin/agente`,
`/admin/vendedores`, `/admin/automatizaciones`), más todo `src/lib/prospects/`
y las migraciones 010 a 014, que están corridas.

Sigue compilando y funcionando igual que siempre. **No recibe más trabajo** hasta
que se enganche con Apptivando CRM, que es donde vive el producto ahora.

**`/admin/crm` — "Mensajes del formulario" — NO está congelado.** Está en el
grupo Ventas del menú, pero es la bandeja de leads del sitio y ya vive en
producción.

Lo que quedó sin hacer y **se resuelve en Apptivando CRM, no acá**:

- Conectar una línea real de vendedor y confirmar que sus mensajes van a la
  ficha y **no** a la Bandeja. Nunca se probó.
- Contador de no leídos en la Bandeja.
- Nunca se mandó un mensaje real de WhatsApp desde la plataforma.
- **[vos]** Las variables `EVOLUTION_*` nunca se cargaron en Vercel. Ya no hace
  falta: la conexión a WhatsApp es problema del proyecto nuevo.

---

# 4. Deuda chica y verificaciones pendientes

| # | Qué | Quién |
|---|---|---|
| 1 | Probar el formulario de contacto de punta a punta: mandarlo con un número y ver que en la ficha el ícono verde quede prendido y aparezca "Abrir en la Bandeja →" | **[vos]** |
| 2 | Probar la subida de un archivo descargable desde el navegador | **[vos]** |
| 3 | Re-probar los tres arreglos de contraseña del 24/08 (cartel al guardar, rechazo de la contraseña vieja, que el gestor ofrezca generar una) | **[vos]** |
| 4 | Completar desde el admin el **RLS1100** (tiene publicado el texto "Completar specs desde catálogo") y el **5D Cash Drawer** (sin especificaciones) | **[vos]** |
| 5 | Sacar un archivo de un producto no lo borra del storage. Las fotos funcionan igual | **[yo]** |
| 6 | **6 errores de lint en `Navbar.tsx` y `Footer.tsx`, en las dos ramas y en producción.** Los introdujo `b0e93d5` (24/09) al pasar las anclas del menú a `/#cat-...`: quedaron como `<a>` en vez de `<Link>`. Funciona, pero cada click recarga la página entera en vez de navegar como SPA | **[yo]** |
| 7 | 2 errores viejos de lint en `ProductForm.tsx` de `main`. Ya están corregidos en `develop` y viajan cuando vaya el resto del panel | — |
| 8 | `scripts/_tmp-fix-emilio.mjs` está sin commitear desde agosto. No es del repo; decidir si va o se borra | **[vos]** |
| 9 | Mandar una invitación y un pedido de recuperación **reales** desde producción, una vez que el port esté en `main`. El correo nunca se probó de punta a punta desde que Resend volvió a estar verificado | **[vos]** |

> **Se fueron a Apptivando CRM:** las 12 fichas marcadas por el auditor, el
> desajuste de `PROSPECT_SEARCH_DAILY_LIMIT` entre Vercel (90) y `.env.local`
> (400) —con el cartel del panel mostrando un techo más bajo que el que frena de
> verdad—, el cron de GitHub que dispara cada 50-80 minutos en vez de cada 5, y
> el agujero de validación por el que un teléfono como `543510000000` pasa el
> chequeo de área aunque el número local sea relleno.

---

# 5. Sitio público y contenido

Del listado completo en `../TAREAS_PENDIENTES.md`:

- **[yo]** Blog `/blog` con template de artículos y CTA final.
- **[yo]** Páginas de soluciones por industria (`/soluciones/[industria]`):
  Retail, Gastronomía, Logística, Autoservicio.
- **[yo]** Sistema de cotización con multi-selección de productos.
- **[yo]** Sección de testimonios y logos de clientes.
- **[yo]** Borrar la imagen del bucket al quitarla desde el admin.
- **[vos]** **80 tareas de carga de contenido**: fotos, descripción,
  especificaciones completas y documentos para cada uno de los 20 productos. Las
  specs están en `../FORCOM_Catalogo_1Q_2026.md`.
- **[vos]** Fichas técnicas en PDF — dependen de que FORCOM las entregue. Hoy
  ningún producto tiene archivos descargables.
- **[vos]** Actualizar el número de WhatsApp real en `/admin/empresa` si sigue el
  placeholder.
- **[vos]** Validar el DNS de `dev.forcom.tech` en Vercel.

---

# 6. Infraestructura — migración a la cuenta nueva de Vercel

> Checklist maestro y orden obligatorio: `../MIGRACION_VERCEL.md`. Quedan **34
> ítems sin tildar**, casi todos tuyos. Los más importantes:

- **[vos]** Guardar los recovery codes de 2FA de la cuenta nueva en un lugar
  seguro. Se perdió el acceso a la cuenta vieja por 2FA irrecuperable.
- **[vos]** ⚠️ **Cargar `SUPABASE_SERVICE_KEY` en Vercel.** Desde el Track E la
  usa el server de la app, al revés de lo que decía la documentación vieja. El
  arreglo del formulario del 23/09 también la usa.
- **[vos]** Apagar wacrm: parar los procesos de PM2 del bridge en la notebook,
  borrar el DNS de `crm-dev.forcom.tech`, archivar el repo `apptivando/ForcomCRM`.
  **Antes de borrar su base: desde el 30/07/2026 tiene leads reales del
  formulario de contacto.**
- **[vos]** Rotar la API key de **Resend** de FORCOM.
- **[vos]** Habilitar los repos en la instalación nueva de la GitHub App.
- **[vos]** Elegir el dominio definitivo.

> **Por qué importa más allá del panel:** los proyectos viejos **no se pueden
> borrar y siguen deployando en cada push** — hay una sola GitHub App de Vercel
> para las dos cuentas, y desinstalarla rompería también la nueva. La única
> defensa es rotar claves para dejar la copia vieja muda.
