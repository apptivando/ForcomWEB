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

export interface ContactMessage {
  id: string;
  name: string;
  company: string | null;
  email: string;
  industry: string | null;
  message: string;
  status: "nuevo" | "leido" | "contactado";
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}
