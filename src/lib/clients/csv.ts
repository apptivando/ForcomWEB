/**
 * Exportación de clientes a CSV.
 *
 * Vive acá y no dentro de `ClientsTable` porque son funciones puras sin JSX, y
 * porque la lista de columnas crece cada vez que se agrega un campo — tenerla
 * mezclada con el markup de una tabla hace que se olvide.
 */

import type { CrmContact } from "@/lib/types";

/** Escapa un campo: comillas dobladas y todo entre comillas. */
function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Los teléfonos se guardan como dígitos pelados. Sin el `+` adelante, Excel los
 * lee como un número gigante y los muestra en notación científica.
 */
function phoneCell(digits: string | null): string {
  return digits ? `+${digits}` : "";
}

const CSV_COLUMNS: Array<[string, (c: CrmContact) => unknown]> = [
  ["Prioridad", (c) => c.contact_tier],
  ["Razón social", (c) => c.business_name],
  ["Nombre de contacto", (c) => c.contact_name],
  ["Origen", (c) => c.origin],
  ["WhatsApp", (c) => phoneCell(c.whatsapp_phone)],
  ["Email", (c) => c.email],
  ["Teléfono", (c) => phoneCell(c.phone)],
  ["Rubro", (c) => c.rubro],
  ["Localidad", (c) => c.locality],
  ["Dirección", (c) => c.address],
  ["Sitio web", (c) => c.website],
  ["Instagram", (c) => c.instagram_url],
  ["Facebook", (c) => c.facebook_url],
  ["LinkedIn", (c) => c.linkedin_url],
  ["Google Maps", (c) => c.google_maps_url],
  ["Rating", (c) => c.rating],
  ["Reseñas", (c) => c.reviews_count],
  ["Estado", (c) => c.enrichment_status],
  ["Contactado el", (c) => c.outreach_at],
  ["Veces contactado", (c) => c.outreach_count],
  ["Notas del enriquecedor", (c) => c.notes],
];

export function downloadClientsCsv(clients: CrmContact[]) {
  const header = CSV_COLUMNS.map(([name]) => csvCell(name)).join(";");
  const rows = clients.map((c) => CSV_COLUMNS.map(([, get]) => csvCell(get(c))).join(";"));
  // Punto y coma como separador y BOM al inicio: es lo que Excel en español
  // espera. Con coma y sin BOM abre todo en una sola columna y rompe los
  // acentos, que es exactamente lo que nadie quiere de un export.
  const csv = `﻿${[header, ...rows].join("\r\n")}`;

  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `clientes-forcom-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
