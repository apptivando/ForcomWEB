# WhatsApp: la línea oficial y las de los vendedores

Cómo están conectados los números de WhatsApp, qué hace cada uno y cómo se
analiza lo que se habla.

---

## Son dos sistemas que no se mezclan

| | **Bandeja** | **Líneas de vendedores** |
|---|---|---|
| Línea | Centroficina, la oficial | Los números de la empresa que usan los vendedores |
| Vía | Meta Cloud API | Baileys, a través de Evolution |
| Para qué | **Atender**: se lee y se responde | **Registrar y analizar**: no se opera desde ahí |
| Dónde se ve | `/admin/inbox` | La ficha del cliente + `/admin/vendedores` |

Los mensajes de las dos **viven en las mismas tablas** (`crm_conversations` y
`crm_messages`). No es un descuido: la línea de tiempo de la ficha del cliente
tiene que mostrar todo junto, venga del canal que venga, y con tablas separadas
habría que duplicar el esquema y toda la lógica de la línea de tiempo.

Lo que los mantiene separados es `wa_lines.kind` y **un solo filtro**, en
`listConversations`: la Bandeja muestra únicamente `kind = 'meta'`. Ese filtro
vive en un único lugar a propósito, para que no se pueda olvidar. El `!inner`
de esa consulta tampoco es decorativo: sin él, una conversación sin línea
asignada se colaría en la Bandeja.

**Un mismo número no puede ser las dos cosas.** Activar Cloud API en una línea
hace que Baileys deje de poder descifrar sus mensajes. Por eso la oficial va
por Meta y las de los vendedores por Baileys, en números distintos.

---

## Conectar una línea

En **`/admin/lineas`**, solo owner o admin. Cargás el nombre, opcionalmente el
número y el usuario del sistema al que corresponde, y se crea la instancia en
Evolution con el webhook ya apuntando a la app. Después, **Vincular teléfono**
muestra el QR: en el celular, WhatsApp → Ajustes → Dispositivos vinculados.

Asociar el usuario hace que los mensajes que esa persona escriba desde su
celular queden a su nombre en la ficha del cliente.

> **Si el QR no aparece**: hay versiones de Evolution donde ese endpoint
> devuelve vacío aunque el Manager sí lo muestre ([#2380](https://github.com/EvolutionAPI/evolution-api/issues/2380),
> [#2385](https://github.com/evolution-foundation/evolution-api/issues/2385)).
> La pantalla lo detecta y ofrece el link al Manager en vez de quedarse
> cargando.

### Los límites, que son dos y conviene no confundir

- **Por número**: 4 dispositivos vinculados además del teléfono. Baileys ocupa
  uno; le quedan tres al vendedor para WhatsApp Web, tablet, etc.
- **Por servidor**: no hay tope en el software, el límite es la RAM. Cada sesión
  mantiene su propio WebSocket, sus claves y su caché. Con 50-100 el consumo se
  dispara; **diez líneas entran cómodas en 4 GB** con Evolution en su propio
  contenedor.

**Baileys no es oficial.** WhatsApp puede bloquear una línea. Con números de la
empresa el daño queda acotado a esa línea, y la principal sigue siendo la de
Meta.

---

## Lo que el vendedor escribe desde el celular

Se registra. Baileys está conectado como dispositivo vinculado, así que cuando
el vendedor escribe desde su teléfono ese mensaje le llega igual y Evolution lo
reenvía por el webhook con `fromMe: true`.

Durante un tiempo eso se estuvo tirando. El webhook tenía un `return` temprano
para `fromMe`, con el comentario "eco de lo que mandamos nosotros" — pero ahí
venían mezcladas dos cosas muy distintas: el eco de lo que mandó la plataforma
(que efectivamente ya está guardado) y **lo que una persona escribió a mano**,
que es justo lo que se perdía todos los días.

Distinguirlas no hace falta: `crm_messages.wa_message_id` es `UNIQUE` desde la
migración 002, así que el eco choca contra el índice y se descarta solo. La
idempotencia estaba construida desde el principio.

**Tres cuidados que van con eso**, y que no son obvios:

1. El `pushName` de un mensaje saliente es el nombre de **nuestro** perfil, no
   el del cliente. Usarlo le pondría a la ficha el nombre del vendedor.
2. Los mensajes salientes llevan el `member_id` de la línea, para que en la
   ficha se vea quién habló.
3. **Las automatizaciones y la IA quedan restringidas a la línea oficial.** Que
   un vendedor reciba un mensaje en su celular no puede disparar una respuesta
   automática de la empresa desde otro número: el cliente vería dos
   interlocutores para la misma consulta.

Los `fromMe` desde el teléfono a veces traen el identificador `@lid` en vez del
número. El webhook ya prefiere `remoteJidAlt` cuando está, que es la mitigación
correcta.

---

## El análisis

En **`/admin/vendedores`**, solo owner o admin — los hallazgos son sobre cómo
trabajó una persona, y eso lo impone RLS, no un `if` de pantalla.

### Lo que no usa IA

Cuántas conversaciones, mensajes recibidos y enviados, cuánto tarda en
contestar y cuántas quedaron con la última palabra del cliente. Sale de mirar
la dirección y la fecha de los mensajes: exacto, instantáneo y gratis. Es
también la métrica que más plata deja sobre la mesa.

Dos decisiones que importan:

- **Mediana, no promedio.** Un mensaje que entra a las 23h y se contesta a las
  9h son diez horas que arruinan cualquier promedio, aunque todo lo demás se
  haya contestado en minutos.
- **"Sin contestar" mira el último mensaje de toda la historia**, no solo el del
  período. Mirando solo el período diría que quedó sin respuesta algo que se
  contestó al otro día.

### Lo que sí usa IA

Solo lo que necesita leer: el caso sutil de haber contestado sin responder lo
que preguntaron, las oportunidades que se dejaron pasar, y el tono.

El prompt es **deliberadamente conservador**: ante la duda, tono "bien" y sin
hallazgos. Un falso positivo sobre cómo trabaja una persona cuesta más que un
falso negativo. La pantalla lo dice explícitamente: es una señal para mirar, no
una calificación.

> **Antes de mostrarle esto a alguien del equipo**, leé los hallazgos contra el
> hilo real. El tono es donde la IA más se equivoca, y conviene calibrar el
> prompt con casos propios antes de que esto sea insumo de una conversación
> sobre el trabajo de una persona.

### Cuándo corre

El endpoint `/api/cron/reviews` hace dos cosas, disparado por el mismo workflow
de GitHub Actions que ya corre cada 5 minutos:

1. **Encola el día anterior**, una sola vez, pasada cierta hora UTC. Esa
   condición horaria es lo que lo hace "nocturno" sin necesitar un scheduler
   aparte. El encolado es idempotente, así que correr de más no duplica.
2. **Procesa un lote** en cada corrida, con reclamo atómico, presupuesto de
   tiempo y watchdog — el mismo patrón que el enriquecedor de prospectos. Así
   el análisis se reparte a lo largo de la mañana en vez de intentar 200
   conversaciones en una sola llamada.

Para probarlo sin esperar: `?enqueue=1` fuerza el encolado.

**No usa la API de lotes**, aunque cuesta la mitad. Se evaluó y no se sostuvo:
son ~200 conversaciones por día, así que el ahorro real son unos pocos dólares
al mes, y a cambio hay que mantener una máquina de estados con su propia tabla.
Si el volumen crece hasta que el ahorro importe, el cambio queda contenido en
`src/lib/analysis/reviewer.ts`.

### El modelo

`ai_config.analysis_model` permite usar uno distinto al del asistente: ése
conversa con clientes y se paga por calidad, éste clasifica de a cientos y se
paga por cantidad. Si está vacío, usa el mismo. `ANALYSIS_MODEL` en el entorno
lo pisa.

---

## El filtrado de lo personal

Conectar la línea de un vendedor registra **todo** lo que pasa por ese número,
no solo lo de trabajo. El análisis marca las conversaciones de tono personal y
la pantalla de Vendedores ofrece **excluir y borrar**.

Borra, no solo deja de registrar: lo que se guardó antes de darse cuenta de que
la conversación era personal sigue siendo una conversación personal guardada.

La exclusión vive en `wa_excluded_numbers`, una tabla propia y no un campo del
contacto, **porque tiene que sobrevivir al borrado**: si fuera un campo, se iría
con la purga y el próximo mensaje volvería a crear la ficha.

> Conviene que el equipo sepa que la línea de la empresa queda registrada y
> analizada. La pantalla de Líneas lo dice, pero decirlo en una pantalla no es
> lo mismo que avisarlo.

---

## Verificar que todo esté en pie

```bash
node scripts/verify-prospects.mjs          # esquema, funciones y datos
node scripts/verify-prospects.mjs --live   # además prueba las APIs y el trigger
```

Chequea las migraciones 010 a 014, incluido el filtro que separa la Bandeja de
las líneas de vendedores.

**La verificación más importante de todo esto**: conectar una línea de prueba,
escribir desde ese celular a un cliente, y confirmar que el mensaje aparece en
la ficha del cliente y **no** en la Bandeja. Si aparece en la Bandeja, el filtro
falló.
