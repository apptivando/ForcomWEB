// Vista previa de los correos transaccionales, sin mandar nada.
//
//   node scripts/preview-email.mjs            → invitación
//   node scripts/preview-email.mjs --resent   → invitación reenviada
//   node scripts/preview-email.mjs --reset    → recuperar contraseña
//   node scripts/preview-email.mjs --text     → además imprime la versión texto
//
// Sirve para mirar el diseño en el navegador antes de que le llegue a alguien.
// El HTML del correo es autocontenido (todo inline), así que lo que se ve acá
// es lo que se ve en el cliente de correo, salvo por las rarezas propias de
// Outlook.

import { register } from "node:module";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

register("./ts-resolve-hook.mjs", import.meta.url);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { invitationEmail } = await import("@/lib/email/invitation.ts");
const { passwordResetEmail } = await import("@/lib/email/password-reset.ts");

const en7Dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const en1Hora = new Date(Date.now() + 60 * 60 * 1000).toISOString();

const { subject, html, text } = process.argv.includes("--reset")
  ? passwordResetEmail({
      email: "emilio.reula@centroficina.com.ar",
      url: "https://forcom.tech/admin/recuperar?token=EJEMPLO-de-token-largo-que-no-sirve",
      expiresAt: en1Hora,
    })
  : invitationEmail({
      email: "emilio.reula@centroficina.com.ar",
      role: "admin",
      url: "https://forcom.tech/admin/join?token=EJEMPLO-de-token-largo-que-no-sirve",
      expiresAt: en7Dias,
      invitedBy: "guillermo.reula@centroficina.com.ar",
      resent: process.argv.includes("--resent"),
    });

const out = resolve(root, ".preview-email.html");
writeFileSync(out, html, "utf8");

console.log("Asunto:", subject);
console.log("HTML:  ", out);
if (process.argv.includes("--text")) {
  console.log("\n--- versión texto plano ---\n");
  console.log(text);
}
