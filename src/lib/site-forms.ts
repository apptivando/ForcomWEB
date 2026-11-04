/**
 * Listas de los formularios públicos (garantía y revendedores). Las usan el
 * formulario, para mostrar las opciones, y la ruta de la API, para validar que
 * lo que llega sea una de ellas. Sin imports de servidor: va a los dos lados.
 */

export const PROVINCES = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones",
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
  "Santiago del Estero", "Tierra del Fuego", "Tucumán",
] as const;

/**
 * Rubro al que le vende el revendedor. Son las industrias que atiende FORCOM
 * (las mismas de la sección Industrias del sitio), por pedido del cliente
 * (04/11/2026). Latin Office usa otra lista, de tipos de comercio.
 */
export const RESELLER_TYPES = [
  "Supermercados",
  "Restaurantes",
  "Farmacias",
  "Logística",
  "Estaciones de servicio",
  "Hotelería",
  "Varios rubros",
  "Otro",
] as const;

/** Meses de garantía de todos los productos FORCOM. */
export const WARRANTY_MONTHS = 12;

/** Vercel no acepta pedidos de más de 4,5 MB; ver api/garantia. */
export const MAX_INVOICE_MB = 4;

/** Hasta cuántos datos entran en la franja de debajo del carrusel. */
export const MAX_FACTS = 6;
