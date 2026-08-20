/**
 * Adaptador de Google Places API (New) — Text Search.
 *
 * Misma forma que `src/lib/evolution.ts`: `fetch` pelado, sin SDK, sin
 * dependencias nuevas. Server-only: nunca importar desde un componente cliente
 * (expondría la API key).
 *
 * Doc: https://developers.google.com/maps/documentation/places/web-service/text-search
 *
 * FACTURACIÓN — importante antes de tocar el FieldMask: se cobra al SKU más
 * alto de la máscara. `websiteUri`, `nationalPhoneNumber`,
 * `internationalPhoneNumber`, `rating` y `userRatingCount` son tier
 * **Enterprise** (USD 28,00 / 1.000 requests en el tramo 0-100k). Sin ellos
 * caeríamos en Pro o Essentials, mucho más barato, pero la herramienta no
 * tendría sentido: el teléfono y el sitio web SON el producto. Se factura por
 * página, no por resultado: una búsqueda de 60 prospectos = 3 requests.
 * Agregar campos a la máscara no encarece nada mientras no se pase de
 * Enterprise; sacarlos sí abarata. No agregar campos "por las dudas".
 */

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/** Sin FieldMask la API devuelve error: no hay lista de campos por defecto. */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.primaryTypeDisplayName",
  "nextPageToken",
].join(",");

import { MAX_PAGES, PAGE_SIZE, MAX_RESULTS } from "./config";

export interface PlaceResult {
  id: string;
  name: string | null;
  address: string | null;
  nationalPhone: string | null;
  internationalPhone: string | null;
  website: string | null;
  mapsUrl: string | null;
  rating: number | null;
  reviewsCount: number | null;
  businessStatus: string | null;
  primaryType: string | null;
}

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  primaryTypeDisplayName?: { text?: string };
}

export class PlacesError extends Error {
  // Campos declarados y asignados a mano en vez de parameter properties:
  // node borra tipos pero no las soporta, y estos módulos se corren con node
  // directo desde los scripts de prueba.
  readonly status: number;
  readonly hint: string | undefined;

  constructor(message: string, status: number, hint?: string) {
    super(message);
    this.name = "PlacesError";
    this.status = status;
    this.hint = hint;
  }
}

function mapPlace(p: RawPlace): PlaceResult | null {
  if (!p.id) return null;
  return {
    id: p.id,
    name: p.displayName?.text ?? null,
    address: p.formattedAddress ?? null,
    nationalPhone: p.nationalPhoneNumber ?? null,
    internationalPhone: p.internationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    mapsUrl: p.googleMapsUri ?? null,
    rating: p.rating ?? null,
    reviewsCount: p.userRatingCount ?? null,
    businessStatus: p.businessStatus ?? null,
    primaryType: p.primaryTypeDisplayName?.text ?? null,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callTextSearch(
  body: Record<string, unknown>,
  apiKey: string,
  attempt = 0
): Promise<{ places: RawPlace[]; nextPageToken?: string }> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (res.ok) return res.json();

  const text = await res.text();

  // 429 y 5xx: backoff exponencial 1s/2s/4s, tres intentos. Con 3 requests por
  // búsqueda esto casi nunca se dispara, pero un 429 sin reintento perdería la
  // búsqueda entera después de haberla pagado.
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await sleep(1000 * 2 ** attempt);
    return callTextSearch(body, apiKey, attempt + 1);
  }

  const hint =
    res.status === 403
      ? "Revisá que 'Places API (New)' esté habilitada en Google Cloud y que la API key no esté restringida a otra API."
      : res.status === 400
        ? "Petición rechazada por Google: suele ser el FieldMask, un includedType inválido, o parámetros que cambiaron entre páginas."
        : undefined;

  throw new PlacesError(`Google Places ${res.status}: ${text.slice(0, 400)}`, res.status, hint);
}

/** Datos de prueba para desarrollar sin gastar cuota ni tener la key cargada. */
async function mockSearch(): Promise<PlaceResult[]> {
  const { MOCK_PLACES } = await import("./places.mock");
  return MOCK_PLACES;
}

export function placesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY) || process.env.GOOGLE_PLACES_MOCK === "1";
}

/**
 * Busca comercios por texto. Devuelve hasta 60 (techo de la API).
 *
 * `maxResults` solo sirve para gastar menos: cada página son 20 resultados y
 * un evento facturable, así que pedir 20 cuesta un tercio que pedir 60.
 */
export async function searchPlaces(opts: {
  query: string;
  includedType?: string;
  maxResults?: number;
}): Promise<PlaceResult[]> {
  const { query, includedType } = opts;
  const maxResults = Math.min(opts.maxResults ?? MAX_RESULTS, MAX_RESULTS);

  if (process.env.GOOGLE_PLACES_MOCK === "1") {
    return (await mockSearch()).slice(0, maxResults);
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new PlacesError(
      "Falta GOOGLE_PLACES_API_KEY",
      0,
      "Cargá la variable en Vercel y en .env.local (y reiniciá `npm run dev`), o poné GOOGLE_PLACES_MOCK=1 para probar con datos de ejemplo."
    );
  }

  const base: Record<string, unknown> = {
    textQuery: query,
    languageCode: "es",
    regionCode: "AR",
    pageSize: PAGE_SIZE,
  };
  if (includedType) base.includedType = includedType;

  const out: PlaceResult[] = [];
  const seen = new Set<string>();
  let pageToken: string | undefined;
  let droppedType = false;

  for (let page = 0; page < MAX_PAGES && out.length < maxResults; page++) {
    // Entre páginas, TODOS los parámetros salvo pageToken y pageSize tienen que
    // ser idénticos o Google devuelve INVALID_ARGUMENT.
    const body = pageToken ? { ...base, pageToken } : base;

    let data: { places: RawPlace[]; nextPageToken?: string };
    try {
      data = await callTextSearch(body, apiKey);
    } catch (err) {
      // Un includedType inválido (la Tabla A cambia con el tiempo) no debería
      // tumbar la búsqueda entera: se reintenta una vez sin el filtro de tipo,
      // que es exactamente el modo "sin filtro" que ya ofrecemos.
      if (err instanceof PlacesError && err.status === 400 && includedType && !droppedType && page === 0) {
        droppedType = true;
        delete base.includedType;
        data = await callTextSearch(base, apiKey);
      } else {
        throw err;
      }
    }

    for (const raw of data.places ?? []) {
      const place = mapPlace(raw);
      if (!place || seen.has(place.id)) continue;
      seen.add(place.id);
      out.push(place);
      if (out.length >= maxResults) break;
    }

    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;

    // La API legacy tenía un retraso de activación del token de ~2s y la doc de
    // la nueva no aclara si sigue existiendo. Un segundo de espera es barato
    // comparado con perder una página ya paga.
    await sleep(1000);
  }

  return out;
}
