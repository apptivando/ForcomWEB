// Adaptador de salida hacia Evolution API (self-hosted, WSL, detrás de
// Cloudflare Tunnel en EVOLUTION_API_URL). El CRM nunca habla con
// WhatsApp directo — todo pasa por acá. Contrato confirmado contra la
// guía real del server (no la doc pública genérica): ver
// FORCOM-integracion-evolution.md.
//
// Server-only — nunca importar desde un componente cliente.

const BASE = process.env.EVOLUTION_API_URL!;
const KEY = process.env.EVOLUTION_API_KEY!;
const DEFAULT_INSTANCE = process.env.EVOLUTION_INSTANCE!;

async function evo(path: string, body?: unknown, method: "POST" | "GET" = "POST") {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", apikey: KEY },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Evolution ${path} → ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Normaliza a solo dígitos (país + número, sin + ni espacios). */
export function toNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

export interface EvolutionSendResult {
  key?: { id?: string };
  [key: string]: unknown;
}

export function sendText(
  phone: string,
  text: string,
  instance = DEFAULT_INSTANCE
): Promise<EvolutionSendResult> {
  return evo(`/message/sendText/${instance}`, { number: toNumber(phone), text });
}

export function sendMedia(
  phone: string,
  opts: {
    mediatype: "image" | "document" | "video" | "audio";
    media: string; // URL pública o base64
    caption?: string;
    fileName?: string;
    mimetype?: string;
  },
  instance = DEFAULT_INSTANCE
): Promise<EvolutionSendResult> {
  return evo(`/message/sendMedia/${instance}`, { number: toNumber(phone), ...opts });
}

export function connectionState(instance = DEFAULT_INSTANCE) {
  return evo(`/instance/connectionState/${instance}`, undefined, "GET");
}
