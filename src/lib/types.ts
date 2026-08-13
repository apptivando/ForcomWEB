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

export interface CrmContact {
  id: string;
  phone: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmConversation {
  id: string;
  contact_id: string;
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
  created_at: string;
  updated_at: string;
}
