"use server";

// Server Actions del análisis de conversaciones de vendedores.
//
// Todo acá es solo para owner/admin: los hallazgos son sobre cómo trabajó una
// persona. RLS ya lo impone en `conversation_reviews`; esto da el error
// legible antes de llegar ahí.

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/roles";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  await requireRole(supabase, "admin");
  return supabase;
}

export interface SellerStat {
  line_id: string;
  line_name: string;
  member_id: string | null;
  conversations: number;
  messages_in: number;
  messages_out: number;
  /** Mediana de lo que tarda en contestar, en segundos. Null si no contestó nada. */
  median_response_s: number | null;
  /** Conversaciones cuya última palabra fue del cliente. */
  unanswered: number;
}

/**
 * Las métricas del período. **No usan IA**: salen de mirar la dirección y la
 * fecha de los mensajes, así que son exactas y no cuestan nada.
 */
export async function getSellerStats(days = 7): Promise<SellerStat[]> {
  const supabase = await requireAdmin();
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase.rpc("seller_stats", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as SellerStat[];
}

export interface ReviewRow {
  id: string;
  conversation_id: string;
  line_id: string | null;
  member_id: string | null;
  day: string;
  status: string;
  unanswered: string[];
  missed: string[];
  tone: { nivel: string; nota?: string } | null;
  personal: boolean;
  summary: string | null;
  error: string | null;
  contact?: { id: string; business_name: string | null; contact_name: string | null; phone: string | null; email: string | null };
}

/**
 * Los hallazgos del período.
 *
 * Por defecto solo trae los que tienen algo que mostrar: una conversación
 * analizada sin nada para señalar es la mayoría de los casos y ocuparía la
 * pantalla con ruido.
 */
export async function listReviews(opts: {
  days?: number;
  lineId?: string;
  onlyPersonal?: boolean;
  includeClean?: boolean;
} = {}): Promise<ReviewRow[]> {
  const supabase = await requireAdmin();
  const since = new Date(Date.now() - (opts.days ?? 7) * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let query = supabase
    .from("conversation_reviews")
    .select(
      "*, conversation:crm_conversations!inner(contact:crm_contacts(id, business_name, contact_name, phone, email))"
    )
    .gte("day", since)
    .order("day", { ascending: false })
    .limit(200);

  if (opts.lineId) query = query.eq("line_id", opts.lineId);
  if (opts.onlyPersonal) query = query.eq("personal", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => {
    const conv = r.conversation as { contact?: ReviewRow["contact"] } | null;
    return { ...r, contact: conv?.contact } as ReviewRow;
  });

  if (opts.includeClean || opts.onlyPersonal) return rows;
  return rows.filter(
    (r) => r.personal || r.unanswered?.length > 0 || r.missed?.length > 0 || r.status === "failed"
  );
}

/** Cuántas conversaciones esperan análisis. */
export async function getReviewQueue(): Promise<{ pending: number; failed: number }> {
  const supabase = await requireAdmin();
  const [{ count: pending }, { count: failed }] = await Promise.all([
    supabase
      .from("conversation_reviews")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "running"]),
    supabase
      .from("conversation_reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
  ]);
  return { pending: pending ?? 0, failed: failed ?? 0 };
}
