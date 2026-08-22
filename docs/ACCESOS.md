# Accesos al panel: invitaciones y contraseñas

Cómo entra alguien nuevo a `/admin` y cómo cambia su contraseña.

---

## El recorrido, de punta a punta

1. Un **Dueño** o **Admin** entra a `/admin/miembros`, escribe la casilla y elige
   el rol.
2. Sale un correo en español con la identidad FORCOM (asunto: *Tu acceso al
   panel de FORCOM*) con un botón **Crear mi contraseña**.
3. El botón lleva a `/admin/join?token=…`, que muestra **la casilla a la que
   queda asociado el acceso** y pide una contraseña.
4. Al guardarla se crea el usuario, se le asigna el rol y **entra directo al
   panel** — sin pasar por el login.
5. Después, cualquiera cambia su propia contraseña en **Mi cuenta**
   (`/admin/cuenta`), que es la misma pantalla en modo cambio: muestra la
   casilla, pide la actual y la nueva.

Mientras la invitación esté pendiente, `/admin/miembros` muestra cuándo vence y
ofrece **Reenviar** (link nuevo, el viejo muere) y **Cancelar**.

---

## Por qué el link no lo emite Supabase

Hasta el 21/08/2026 las invitaciones salían con
`auth.admin.inviteUserByEmail`: el correo de Supabase, en inglés, con su
diseño, y con un token de un solo uso que **se consume con un GET**.

Los filtros de seguridad de las casillas corporativas (Defender/Outlook y
compañía) abren todos los links de un correo *antes* de entregarlo, para
revisarlos. Eso quemaba el token: cuando la persona finalmente hacía clic, el
link ya estaba usado y le aparecía "inválido o vencido".

Pasó con `emilio.reula@centroficina.com.ar`: el usuario quedó creado y con
`last_sign_in_at` **24 segundos** después de mandada la invitación, sin que
nadie hubiera tocado nada.

El flujo propio lo evita por diseño: **abrir el link no consume nada.**
`/admin/join` solo lee la invitación para mostrar el formulario; el token
recién se marca como usado cuando llega la contraseña por POST. Un escáner que
abra el link no rompe nada.

Efecto lateral bienvenido: el correo es nuestro, así que está en español, con
la marca, y se puede cambiar sin tocar la configuración de Supabase.

---

## Las piezas

| Archivo | Qué hace |
|---|---|
| `src/lib/auth/invitations.ts` | Emite y valida el token. `lookupInvitation()` es **solo lectura**. |
| `src/lib/auth/password.ts` | La regla de contraseñas, compartida por el formulario y la server action. |
| `src/lib/email/layout.ts` | Layout base de los correos, con la identidad FORCOM. |
| `src/lib/email/invitation.ts` | El correo de invitación (HTML + texto plano). |
| `src/lib/email/send.ts` | Envío por Resend. **Tira si falla** (a diferencia del mail del formulario, que es best-effort). |
| `src/components/admin/PasswordForm.tsx` | La pantalla de contraseña, en sus dos modos. |
| `src/app/admin/join/page.tsx` | Aceptar la invitación. Server component: valida antes de pintar. |
| `src/app/admin/(panel)/cuenta/page.tsx` | Mi cuenta — cambio de contraseña. |

En la base: `admin_invitations.token_hash` (SHA-256 del token, migración
`015_invitaciones_propias.sql`). El token en claro **solo existe en el correo**:
si se pierde, se reenvía. Al aceptar se pone en `NULL` — un solo uso.

---

## Ver el correo sin mandarlo

```
node scripts/preview-email.mjs --text
```

Escribe `.preview-email.html` (ignorado por git) para abrir en el navegador e
imprime la versión en texto plano. `--resent` muestra la variante de reenvío.

---

## Cosas para tener presentes

- **El remitente es `noreply@forcom.tech`** (`RESEND_FROM_EMAIL`), que es el
  dominio verificado en Resend. Para mandar desde `@centroficina.com.ar` hay que
  dar de alta ese dominio en Resend y cargar sus registros DNS; el código no
  cambia, solo la variable.
- **Sin `RESEND_API_KEY` no se puede invitar.** La acción falla con un error
  claro en vez de guardar una invitación que nunca va a llegar: si el correo no
  sale, la fila se borra.
- **Las invitaciones del flujo viejo tienen `token_hash` en NULL** y no se
  pueden aceptar. Hay que reenviarlas desde `/admin/miembros`.
- **No hay "olvidé mi contraseña"**: quien se quede afuera necesita que un
  admin lo invite de nuevo. Si llega a hacer falta, el flujo de recuperación
  reusa las mismas piezas (token + `PasswordForm`).
- El cambio de contraseña **pide la actual** aunque haya sesión abierta, para
  que una máquina desbloqueada no sea una cuenta regalada.
