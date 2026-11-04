/**
 * Utilidades de las rutas que reciben los formularios públicos de garantía y
 * revendedores. Server-only. Vienen de LatinOfficeWEB (`src/lib/forms.ts`):
 * si se cambia algo acá, conviene cambiarlo allá también.
 */
import { NextResponse } from "next/server";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PHONE_ERROR =
  "Revisá el teléfono: escribilo con código de área, sin 0 ni 15. Ej.: 11 41234567.";

/** Texto del formulario: recortado, sin etiquetas y con tope de largo. */
export function clean(value: unknown, max = 500): string {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, "").trim().slice(0, max);
}

export function ok(extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...extra });
}

/** Error para mostrarle a la persona, en el formato que espera el formulario. */
export function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export const SAVE_ERROR =
  "No pudimos guardar tu envío. Probá de nuevo en unos minutos o escribinos por WhatsApp.";

/** Hoy en Argentina, como "AAAA-MM-DD". */
export function todayAR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

/** "AAAA-MM-DD" + 12 meses. El 29/02 pasa al 01/03, igual que en el formulario. */
export function addOneYear(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y + 1, m - 1, d)).toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Tipo real del archivo por sus primeros bytes. El `type` que manda el
 * navegador lo decide el cliente y no sirve para validar.
 */
export function sniffInvoice(bytes: Uint8Array): { mime: string; ext: string } | null {
  const at = (i: number) => bytes[i];
  const ascii = (from: number, len: number) => String.fromCharCode(...bytes.slice(from, from + len));
  if (ascii(0, 4) === "%PDF") return { mime: "application/pdf", ext: "pdf" };
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (at(0) === 0x89 && ascii(1, 3) === "PNG") return { mime: "image/png", ext: "png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (ascii(4, 4) === "ftyp" && /^(heic|heix|hevc|mif1|msf1|heif)$/.test(ascii(8, 4))) return { mime: "image/heic", ext: "heic" };
  return null;
}
