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

> ## El CRM ya no está en este repo (26/10/2026)
>
> Se mudó a Apptivando CRM (`c:\Apptivando\ApptivandoCRM`) el 24/09 y el
> 26/10 se sacó del todo: de `develop`, de la base y del menú. Los planes que
> eran del CRM —cola de llamadas, campañas de correo con EnvíaloSimple, el paso B
> del nivel 3 del enriquecedor— ya figuran en el backlog de Apptivando CRM como
> "heredados de Forcom". El texto completo de esos planes quedó en la etiqueta
> `crm-congelado-2026-10-26` (`git show crm-congelado-2026-10-26:Futuro.md`).
>
> Lo que queda acá es el sitio público y el panel de contenido.

---

# 1. Decisiones tuyas que destraban trabajo

| # | Decisión | Por qué está frenada |
|---|---|---|
| 1 | **[vos]** ¿Cuándo y cómo se engancha Apptivando CRM en el panel de FORCOM? | Está previsto embeberlo en un iframe desde un subdominio propio, con la marca de FORCOM. La decisión y el plan son del otro repo; acá solo haría falta el enlace o el iframe. |

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

# 3. Deuda chica y verificaciones pendientes

| # | Qué | Quién |
|---|---|---|
| 1 | Mandar un mensaje real desde el formulario de forcom.tech, con teléfono, y ver que aparezca en Mensajes del formulario y que llegue el mail a ventas. Después marcarlo como spam o borrarlo | **[vos]** |
| 2 | Probar la subida de un archivo descargable desde el navegador | **[vos]** |
| 3 | Re-probar los tres arreglos de contraseña del 24/08 (cartel al guardar, rechazo de la contraseña vieja, que el gestor ofrezca generar una) | **[vos]** |
| 4 | Completar desde el admin el **RLS1100** (tiene publicado el texto "Completar specs desde catálogo") y el **5D Cash Drawer** (sin especificaciones) | **[vos]** |
| 5 | Sacar un archivo de un producto no lo borra del storage. Las fotos funcionan igual | **[yo]** |
| 6 | **6 errores de lint en `Navbar.tsx` y `Footer.tsx`, en las dos ramas y en producción.** Los introdujo `b0e93d5` (24/09) al pasar las anclas del menú a `/#cat-...`: quedaron como `<a>` en vez de `<Link>`. Funciona, pero cada click recarga la página entera en vez de navegar como SPA | **[yo]** |
| 7 | Que **Emilio Reula** entre al panel y se arme su propia contraseña con "Olvidé mi contraseña". Desde el 21/08 tiene una provisional que se le dictó por teléfono, y su cuenta no registra ningún ingreso propio (el único es la prueba del script que la creó, borrado el 26/10) | **[vos]** |
| 8 | Mandar una invitación y un pedido de recuperación **reales** desde producción. El correo nunca se probó de punta a punta desde que Resend volvió a estar verificado | **[vos]** |

---

# 4. Sitio público y contenido

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
- **[vos]** Fichas técnicas en PDF — dependen de que FORCOM las entregue. Desde
  el 26/10 se suben desde el admin del producto.

---

# 5. Infraestructura — migración a la cuenta nueva de Vercel

> Checklist maestro y orden obligatorio: `../MIGRACION_VERCEL.md` (cubre también
> OnConcilia y Apptivando ML). El proyecto de FORCOM ya está andando en la
> cuenta nueva y wacrm ya se apagó (06/08). Lo que queda de FORCOM:

- **[vos]** Guardar los recovery codes de 2FA de la cuenta nueva en un lugar
  seguro. Se perdió el acceso a la cuenta vieja por 2FA irrecuperable.
- **[vos]** Rotar la API key de **Resend** de FORCOM.
- **[vos]** Habilitar los repos en la instalación nueva de la GitHub App.
- **[vos]** Probar en la cuenta nueva: home, una ficha de producto y el login
  del admin (último ítem sin tildar del Track 1B).
- **[vos]** Elegir el dominio definitivo.

> **Por qué importa más allá del panel:** los proyectos viejos **no se pueden
> borrar y siguen deployando en cada push** — hay una sola GitHub App de Vercel
> para las dos cuentas, y desinstalarla rompería también la nueva. La única
> defensa es rotar claves para dejar la copia vieja muda.
