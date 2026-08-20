/**
 * Cómo se ven el origen, la prioridad y el estado de un cliente.
 *
 * Vive fuera de `ClientsTable` porque la ficha lateral muestra los mismos
 * badges: duplicarlos garantizaría que en algún momento se desincronicen y que
 * el mismo cliente se vea de dos colores distintos según dónde lo mires.
 */

import type { ClientOrigin, ContactTier } from "@/lib/types";

export const ORIGIN_STYLE: Record<ClientOrigin, { label: string; className: string }> = {
  busqueda: { label: "Búsqueda", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  whatsapp: { label: "WhatsApp", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  formulario: { label: "Formulario", className: "bg-[#E8231A]/10 text-[#E8231A] border-[#E8231A]/20" },
  manual: { label: "Manual", className: "bg-[#2A2A2E] text-[#B0B0B0] border-[#2A2A2E]" },
};

export const TIER_LABEL: Record<ContactTier, string> = {
  1: "Con WhatsApp",
  2: "Con email",
  3: "Solo teléfono",
  4: "Sin contacto",
};

/**
 * Solo los estados que valen la pena mostrar. `done` y `skipped` no aparecen a
 * propósito: son la mayoría de las fichas y decir "listo" en cada fila es
 * ruido.
 */
export const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  pending: { text: "En cola", className: "text-[#8A8A8A]" },
  running: { text: "Buscando…", className: "text-blue-400" },
  failed: { text: "Falló", className: "text-[#E8231A]" },
};

/** Cuánto llegó a averiguar la cascada de enriquecimiento. */
export const ENRICHMENT_LEVEL_LABEL: Record<number, string> = {
  0: "Solo lo que dio Google Maps",
  1: "Se visitó el sitio del comercio",
  3: "Se buscó en la web",
  4: "Se agotaron las fuentes sin encontrar contacto",
};

export const WHATSAPP_SOURCE_LABEL: Record<string, string> = {
  link: "por un enlace de WhatsApp en su sitio",
  texto: "por un número junto a la palabra WhatsApp",
  busqueda: "por un resultado de búsqueda",
  manual: "cargado a mano",
};
