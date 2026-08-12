import crypto from "crypto";

// AES-256-GCM, mismo patrón que src/lib/whatsapp/encryption.ts de
// wacrm — formato "iv:ciphertext:authTag" en hex. Usa ENCRYPTION_KEY
// (32 bytes, hex) del entorno. Server-only.

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error("ENCRYPTION_KEY no está configurada");
  return Buffer.from(hex, "hex");
}

export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${ciphertext.toString("hex")}:${authTag.toString("hex")}`;
}

export function decrypt(payload: string): string {
  const [ivHex, ciphertextHex, authTagHex] = payload.split(":");
  if (!ivHex || !ciphertextHex || !authTagHex) {
    throw new Error("Formato de valor cifrado inválido");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}
