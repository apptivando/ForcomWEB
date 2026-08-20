/**
 * Constantes puras del scraper de prospectos.
 *
 * Viven separadas de `places.ts` a propósito: ese módulo hace `fetch` con la
 * API key y lee `process.env`, así que importarlo desde un componente cliente
 * arrastraría código de servidor al bundle del navegador. Acá no hay nada más
 * que datos, así que se puede importar desde los dos lados.
 */

/** Techo duro de Google Places Text Search: 3 páginas de 20. No es negociable. */
export const MAX_PAGES = 3;
export const PAGE_SIZE = 20;
export const MAX_RESULTS = MAX_PAGES * PAGE_SIZE;

/**
 * Tipos de negocio de la Tabla A de Places, mapeados a los rubros que le
 * interesan a FORCOM. Es opcional y acota mucho el ruido, pero solo se puede
 * mandar UNO por búsqueda. Para rubros en español que no mapean limpio el
 * texto libre anda mejor — por eso el default es "sin filtro".
 *
 * Si Google saca o renombra un tipo, `searchPlaces` reintenta una vez sin el
 * filtro en vez de tirar la búsqueda entera.
 */
export const INCLUDED_TYPES = [
  { value: "", label: "Sin filtro de tipo (recomendado)" },
  { value: "supermarket", label: "Supermercados" },
  { value: "grocery_store", label: "Almacenes / autoservicios" },
  { value: "convenience_store", label: "Kioscos / maxikioscos" },
  { value: "restaurant", label: "Restaurantes" },
  { value: "cafe", label: "Cafeterías" },
  { value: "bakery", label: "Panaderías" },
  { value: "bar", label: "Bares" },
  { value: "pharmacy", label: "Farmacias" },
  { value: "gas_station", label: "Estaciones de servicio" },
  { value: "lodging", label: "Hotelería" },
  { value: "hardware_store", label: "Ferreterías" },
  { value: "clothing_store", label: "Indumentaria" },
  { value: "shopping_mall", label: "Centros comerciales" },
  { value: "store", label: "Comercios (genérico)" },
] as const;
