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

async function evo(path: string, body?: unknown, method: "POST" | "GET" | "DELETE" = "POST") {
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

// ─── Gestión de instancias ───────────────────────────────────────────────────
// Una instancia de Evolution = una línea de WhatsApp = un dispositivo vinculado
// a ese número, igual que WhatsApp Web. Cada una mantiene su propio WebSocket,
// sus claves y su caché, así que el límite práctico lo pone la RAM del
// servidor, no el software. Diez líneas entran cómodas en 4 GB.
//
// Del lado de WhatsApp el límite sí es duro: 4 dispositivos vinculados por
// número además del teléfono. Baileys ocupa uno.

export interface EvolutionInstance {
  instanceName: string;
  state?: string;
  ownerJid?: string;
  profileName?: string;
}

/** Crea la instancia y deja el webhook apuntando a esta app. */
export async function createInstance(opts: {
  instanceName: string;
  webhookUrl: string;
  webhookToken: string;
}): Promise<unknown> {
  return evo("/instance/create", {
    instanceName: opts.instanceName,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
    webhook: {
      url: opts.webhookUrl,
      byEvents: false,
      base64: false,
      headers: { Authorization: `Bearer ${opts.webhookToken}` },
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
    },
  });
}

export interface ConnectResult {
  /** Imagen del QR en base64, lista para un <img src>. */
  base64?: string;
  /** El contenido crudo del QR, por si hay que dibujarlo de otra forma. */
  code?: string;
  /** Alternativa al QR: un código de 8 dígitos que se escribe en el teléfono. */
  pairingCode?: string;
}

/**
 * Pide el QR para vincular la línea.
 *
 * Ojo: hay versiones de Evolution en las que este endpoint devuelve `{count: 0}`
 * sin QR aunque el Manager sí lo muestre (issues #2380 y #2385 del repo). Por
 * eso la pantalla contempla que venga vacío y ofrece el Manager como salida, en
 * vez de quedarse cargando para siempre.
 */
export async function connectInstance(instance: string): Promise<ConnectResult> {
  return evo(`/instance/connect/${instance}`, undefined, "GET");
}

export async function fetchInstances(): Promise<EvolutionInstance[]> {
  const data = await evo("/instance/fetchInstances", undefined, "GET");
  // La forma de la respuesta cambió entre versiones: a veces es un array
  // plano, a veces objetos con la instancia adentro.
  const list = Array.isArray(data) ? data : [];
  return list.map((raw: Record<string, unknown>) => {
    const inner = (raw.instance ?? raw) as Record<string, unknown>;
    return {
      instanceName: String(inner.instanceName ?? inner.name ?? ""),
      state: inner.connectionStatus ? String(inner.connectionStatus) : (inner.state ? String(inner.state) : undefined),
      ownerJid: inner.ownerJid ? String(inner.ownerJid) : undefined,
      profileName: inner.profileName ? String(inner.profileName) : undefined,
    };
  });
}

/** Cierra la sesión sin borrar la instancia: se puede volver a escanear. */
export function logoutInstance(instance: string) {
  return evo(`/instance/logout/${instance}`, undefined, "DELETE");
}

export function deleteInstance(instance: string) {
  return evo(`/instance/delete/${instance}`, undefined, "DELETE");
}
