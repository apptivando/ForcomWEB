/**
 * Nombre único de cada sección del panel.
 *
 * Existe porque el mismo nombre se usa en tres lugares que hasta ahora decían
 * cosas distintas: el ítem del menú, el encabezado de la página y el `<title>`
 * de la pestaña ("Mensajes del formulario" en el menú vs. "Mensajes / CRM" en
 * la página, "Sección Hero" vs. "Carrusel Hero", etc.). Un solo nombre por
 * sección, y de acá lo toman todos.
 *
 * Las rutas son las mismas que en LatinOfficeWEB (04/11/2026): portada, datos,
 * mensajes, garantias, revendedores. Forcom tiene un solo catálogo
 * (`catalogo`); Latin Office tiene dos (`catalogos`).
 */
export const SECTION_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  portada: "Portada",
  datos: "Franja de datos",
  productos: "Productos",
  catalogo: "Catálogo",
  empresa: "Info empresa",
  mensajes: "Mensajes de contacto",
  garantias: "Garantías",
  revendedores: "Revendedores",
  miembros: "Miembros",
  cuenta: "Mi cuenta",
};

/** El primer segmento después de `/admin/` — o null si la ruta no es del panel. */
export function sectionSlug(pathname: string): string | null {
  const m = pathname.match(/^\/admin\/([^/?#]+)/);
  return m ? m[1] : null;
}

/** Nombre lindo de la sección a partir del pathname. Fallback genérico. */
export function sectionLabel(pathname: string): string {
  const slug = sectionSlug(pathname);
  return (slug && SECTION_LABEL[slug]) || "Esta sección";
}

/** Título de pestaña por ruta: "Productos · Panel FORCOM". */
export function sectionTitle(slug: string): string {
  const label = SECTION_LABEL[slug];
  return label ? `${label} · Panel FORCOM` : "Panel FORCOM";
}
