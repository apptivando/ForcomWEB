export interface HeroContent {
  id: number;
  badge_text: string;
  headline_line1: string;
  headline_line2: string;
  headline_red: string;
  subheadline: string;
  cta_primary: string;
  cta_secondary: string;
  trust_item_1: string;
  trust_item_2: string;
  trust_item_3: string;
  hero_image_url: string | null;
  updated_at: string;
}

export interface ProductFile {
  name: string;
  url: string;
  type: 'driver' | 'folleto' | 'manual' | 'otro';
}

export interface Product {
  id: string;
  slug: string;
  model: string;
  category: string;
  section: string;
  section_id: string;
  badge: string | null;
  image_url: string | null;
  images: string[];
  videos: string[];
  description: string | null;
  full_specs: string | null;
  files: ProductFile[];
  specs: string[];
  active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface HeroSlide {
  id: string;
  badge_text: string;
  headline_line1: string;
  headline_line2: string;
  headline_accent: string;
  subheadline: string;
  cta_label: string;
  cta_category: string | null;
  cta_url: string | null;
  image_url: string | null;
  image_alt: string;
  image_tag: string;
  active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyInfo {
  id: number;
  whatsapp: string;
  email: string;
  phone: string;
  schedule: string;
  updated_at: string;
}

export interface AdminMember {
  user_id: string;
  role: "owner" | "admin" | "agent";
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminInvitation {
  id: string;
  email: string;
  role: "owner" | "admin" | "agent";
  invited_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

/** De dónde salió el cliente. Es la etiqueta que se muestra en /admin/clientes. */
export type ClientOrigin = "busqueda" | "whatsapp" | "formulario" | "manual" | "vendedor";

/**
 * Una línea de WhatsApp conectada al sistema.
 *
 * `kind` separa dos mundos que no se mezclan: `meta` es la línea oficial de la
 * empresa, la única que se atiende desde la Bandeja; `baileys` son los números
 * de los vendedores, que **solo registran** lo que se habla para que quede en
 * la ficha del cliente y se pueda analizar después.
 *
 * Un mismo número no puede ser las dos cosas: activar Cloud API en una línea
 * hace que Baileys deje de poder descifrar sus mensajes.
 */
export interface WaLine {
  id: string;
  name: string;
  kind: "meta" | "baileys";
  /** Nombre de la instancia en Evolution. Null en las líneas de Meta. */
  instance: string | null;
  phone: string | null;
  /** De qué vendedor es. Null en la oficial, que es de la empresa. */
  member_id: string | null;
  active: boolean;
  /** Último estado que reportó Evolution: open | close | connecting. */
  conn_state: string | null;
  conn_checked_at: string | null;
  last_message_at: string | null;
  /** La línea a la que se asignan las conversaciones abiertas desde la plataforma. */
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

/** 1 WhatsApp · 2 email · 3 teléfono · 4 sin contacto. Lo calcula la base. */
export type ContactTier = 1 | 2 | 3 | 4;

/**
 * Ficha única de cliente (tabla `crm_contacts`). Desde la migración 010 no son
 * solo los contactos de WhatsApp: también entran acá los prospectos que trae el
 * scraper de Google Places y los leads del formulario web, diferenciados por
 * `origin`. El nombre viejo del tipo se mantiene porque la tabla se sigue
 * llamando `crm_contacts` y la usan el Pipeline, la Bandeja y las automatizaciones.
 *
 * Los dos nombres son deliberadamente distintos y los escriben fuentes
 * distintas: `business_name` es la razón social (Google Places, el campo
 * "empresa" del formulario, o edición manual) y `contact_name` es el nombre de
 * la persona (el `pushName` de WhatsApp, el campo "nombre" del formulario, o
 * edición manual). Nunca se pisan entre sí. Para mostrar, usar `clientLabel()`.
 */
export interface CrmContact {
  id: string;
  /** E.164 sin '+', ej. 5493511234567. Nullable desde la 010. */
  phone: string | null;
  contact_name: string | null;
  business_name: string | null;
  origin: ClientOrigin;

  email: string | null;
  rubro: string | null;
  locality: string | null;
  address: string | null;
  website: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;

  google_place_id: string | null;
  google_maps_url: string | null;
  google_synced_at: string | null;
  rating: number | null;
  reviews_count: number | null;

  /** Solo se completa con evidencia real; nunca por parecerse a un celular. */
  whatsapp_phone: string | null;
  whatsapp_source: "link" | "texto" | "busqueda" | "manual" | null;
  /** El teléfono de Google venía marcado como celular (+54 9). No es evidencia. */
  whatsapp_likely: boolean;

  enrichment_status: "pending" | "running" | "done" | "failed" | "skipped";
  /** Hasta qué nivel de la cascada llegó: 0 Places · 1 sitio · 3 búsqueda · 4 agotado. */
  enrichment_level: number;
  enrichment_error: string | null;
  scrape_attempts: number;
  last_scraped_at: string | null;
  /** Alguien editó la ficha a mano: ningún proceso automático la vuelve a tocar. */
  manual_lock: boolean;
  /**
   * Bloc del enriquecedor automático. Las notas que escribe una persona van en
   * `crm_events` con `kind='note'` — ver la migración 012.
   */
  notes: string | null;

  /** Primer contacto en frío. No se pisa: sirve para saber desde cuándo se lo trabaja. */
  outreach_at: string | null;
  outreach_count: number;

  /** SOLO LECTURA — columna GENERATED. Mandarla en un insert/update revienta. */
  contact_tier: ContactTier;

  created_at: string;
  updated_at: string;
}

/** Nombre a mostrar: la razón social manda; si no hay, la persona; si no, el teléfono. */
export function clientLabel(c: Pick<CrmContact, "business_name" | "contact_name" | "phone" | "email">): string {
  return c.business_name || c.contact_name || c.phone || c.email || "Sin nombre";
}

/** Línea secundaria: el nombre que NO se usó como principal, si aporta algo. */
export function clientSubLabel(c: Pick<CrmContact, "business_name" | "contact_name">): string | null {
  return c.business_name && c.contact_name ? c.contact_name : null;
}

/**
 * Filas por página en /admin/clientes. Vive acá y no en `actions.ts` porque un
 * módulo "use server" solo puede exportar funciones async — una constante ahí
 * rompe el build.
 */
export const CLIENTS_PAGE_SIZE = 50;

/**
 * Una entrada del registro de la ficha — el "chatter" de la ficha de cliente.
 *
 * Una sola tabla cubre las notas que escribe una persona y los eventos que
 * registra el sistema, porque la línea de tiempo tiene que paginar por fecha:
 * con dos tablas, cada página sería un merge de dos listas paginadas por
 * separado, correcto en la primera página y roto en la segunda.
 *
 * La diferencia de ciclo de vida la sostiene RLS, no el esquema: solo se puede
 * insertar `kind='note'` y a nombre propio; el resto lo escribe un trigger.
 */
export interface CrmEvent {
  id: string;
  contact_id: string;
  kind: "note" | "deal_created" | "deal_moved" | "deal_updated" | "deal_deleted" | "edited";
  body: string | null;
  /** Datos del evento. Los nombres de etapa van COPIADOS, no por id. */
  meta: Record<string, unknown>;
  actor_member_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Una fila de la línea de tiempo del cliente, como la devuelve la función
 * `contact_timeline` de Postgres: cuatro fuentes distintas normalizadas a la
 * misma forma y ordenadas juntas.
 */
export interface TimelineItem {
  source: "event" | "wa" | "form" | "search";
  ref_id: string;
  /**
   * Los `kind` de `CrmEvent`, más los propios de cada fuente:
   * `wa_in` · `wa_out` · `form_message` · `from_search`.
   */
  kind: string;
  at: string;
  body: string | null;
  meta: Record<string, unknown>;
  actor_id: string | null;
}

/**
 * Plantilla de contacto inicial. Modelada con los campos que pide Meta
 * (nombre, idioma, categoría, estado de aprobación) desde antes de migrar a la
 * Cloud API, para no tener que rehacerla después.
 *
 * Distinta de `QuickReply` a propósito: una respuesta rápida es texto que un
 * agente inserta dentro de una conversación ya abierta y no necesita
 * aprobación de nadie; una plantilla INICIA la conversación y Meta la tiene que
 * aprobar antes de que se pueda usar.
 */
export interface OutreachTemplate {
  id: string;
  name: string;
  meta_template_name: string | null;
  language: string;
  category: "marketing" | "utility" | "authentication";
  status: "borrador" | "enviada" | "aprobada" | "rechazada";
  rejection_reason: string | null;
  /** Con marcadores {{1}}, {{2}}… igual que Meta. */
  body: string;
  /** Qué representa cada marcador, en orden. Ej: ["nombre de contacto", "rubro"]. */
  variables: string[];
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Una corrida del buscador de prospectos (rubro + localidad). */
export interface ProspectSearch {
  id: string;
  rubro: string;
  locality: string;
  query: string;
  included_type: string | null;
  status: "running" | "done" | "error";
  results_count: number;
  new_count: number;
  error: string | null;
  created_by: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface CrmConversation {
  id: string;
  contact_id: string;
  /** De qué línea vino. Null solo en datos anteriores a la migración 013. */
  line_id: string | null;
  /** Presente cuando la consulta la trae embebida. */
  line?: Pick<WaLine, "id" | "name" | "kind">;
  status: "open" | "closed";
  last_message_text: string | null;
  last_message_at: string | null;
  ai_autoreply_disabled: boolean;
  assigned_member_id: string | null;
  created_at: string;
  updated_at: string;
  contact: CrmContact;
}

export interface CrmMessage {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  content_type: string;
  content_text: string | null;
  media_url: string | null;
  wa_message_id: string | null;
  ai_generated: boolean;
  sender_member_id: string | null;
  created_at: string;
}

export interface AiConfig {
  provider: "anthropic" | "openai";
  model: string;
  hasApiKey: boolean;
  hasEmbeddingsKey: boolean;
  system_prompt: string;
  auto_reply_enabled: boolean;
  max_replies_per_conversation: number;
}

export interface AiKnowledgeDocument {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationStep {
  id?: string;
  step_index: number;
  action_type: "send_message" | "wait" | "assign_agent";
  message_text: string | null;
  wait_minutes: number | null;
  assign_member_id: string | null;
}

export interface Automation {
  id: string;
  name: string;
  trigger_type: "keyword_match" | "new_conversation";
  trigger_keywords: string[] | null;
  active: boolean;
  created_at: string;
  steps: AutomationStep[];
}

export interface PipelineStage {
  id: string;
  name: string;
  order_index: number;
}

export interface PipelineDeal {
  id: string;
  contact_id: string;
  stage_id: string;
  title: string;
  value: number | null;
  notes: string | null;
  assigned_member_id: string | null;
  created_at: string;
  updated_at: string;
  contact: CrmContact;
}

export interface QuickReply {
  id: string;
  title: string;
  body: string;
  created_by: string | null;
  created_at: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  industry: string | null;
  message: string;
  status: "nuevo" | "leido" | "contactado";
  admin_notes: string | null;
  /** Ficha del cliente en `crm_contacts`. La llena la fase 7 (migración 010). */
  contact_id: string | null;
  created_at: string;
  updated_at: string;
}
