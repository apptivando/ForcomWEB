"use client";

/**
 * Piezas compartidas de los formularios públicos de garantía y revendedores.
 * Vienen de LatinOfficeWEB (`components/site/formkit.ts`); acá se suman las
 * clases de Tailwind del sitio de FORCOM, las mismas del formulario de Contacto.
 */
import { useEffect, useRef } from "react";
import { HONEYPOT_FIELD } from "@/lib/antispam";

export const GENERIC_ERROR =
  "No pudimos enviar el formulario. Probá de nuevo en unos minutos o escribinos por WhatsApp.";
export const NETWORK_ERROR = "No pudimos enviar el formulario. Revisá tu conexión y probá de nuevo.";

export const inputCls =
  "w-full bg-forcom-black border border-forcom-border rounded-sm px-4 py-3 text-white placeholder:text-forcom-gray/50 focus:border-forcom-red focus:outline-none transition-colors disabled:opacity-60";
export const labelCls =
  "block font-display font-semibold text-xs tracking-[0.15em] uppercase text-forcom-gray mb-2";
export const submitCls =
  "w-full px-8 py-4 bg-forcom-red-dark text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-forcom-red transition-colors disabled:opacity-60";
export const errorCls =
  "text-sm text-forcom-red-text bg-forcom-red/10 border border-forcom-red/20 rounded-sm px-3 py-2";

export function emailOk(v: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
}

/**
 * Datos anti-bot que viajan con cada envío: cuánto tardó la persona en
 * completar el formulario y el campo trampa (ver lib/antispam).
 */
export function useAntispam() {
  const mountedAt = useRef(0);
  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);
  return {
    honeypotName: HONEYPOT_FIELD,
    elapsedMs: () => (mountedAt.current ? Date.now() - mountedAt.current : 0),
  };
}

type ApiResult = { ok: true; [k: string]: unknown } | { ok: false; error: string };

/** POST que siempre resuelve: nunca tira, devuelve el error para mostrar. */
export async function post(url: string, body: FormData | Record<string, unknown>): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      ...(body instanceof FormData
        ? { body }
        : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    });
    const data = (await res.json().catch(() => null)) as ApiResult | null;
    if (!data) return { ok: false, error: GENERIC_ERROR };
    if (!data.ok) return { ok: false, error: data.error || GENERIC_ERROR };
    return data;
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}
