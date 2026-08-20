import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enrichBatch } from "@/lib/prospects/enrich";

/**
 * Enriquecimiento de prospectos por lotes.
 *
 * Lo dispara el mismo workflow de GitHub Actions que ya llama a
 * `/api/cron/automations` (`.github/workflows/automations-cron.yml`, cada 5
 * minutos), con el mismo `CRON_SECRET`. No usa Vercel Cron: los cron de esa
 * cuenta están ocupados por otro proyecto.
 *
 * El lote es chico a propósito. Cada prospecto puede visitar hasta 4 páginas
 * con 1,5s de espera entre pedidos, así que 6 son ~2 minutos en el peor caso —
 * cómodo dentro de la ventana de 5 minutos entre corridas, y sin llegar nunca
 * al límite de duración de la función.
 */

// Explícito aunque hoy coincida con el default de Vercel: documenta la
// intención y sobrevive a un cambio de configuración del proyecto.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DEFAULT_BATCH = 6;
/** Presupuesto propio, más corto que maxDuration: el loop corta antes de que
 *  Vercel mate el proceso a mitad de un UPDATE y deje fichas en 'running'. */
const TIME_BUDGET_MS = 240_000;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || DEFAULT_BATCH, 1), 25);

  const db = createAdminClient();
  try {
    const result = await enrichBatch(db, { limit, deadline: Date.now() + TIME_BUDGET_MS });
    return NextResponse.json({
      ok: true,
      processed: result.processed,
      requeued: result.requeued,
      found: result.found,
      quotaUsed: result.quotaUsed,
      quotaExhausted: result.quotaExhausted,
    });
  } catch (err) {
    // Un 500 acá hace que el step del workflow quede en rojo, que es
    // justamente lo que queremos: el error se ve en la pestaña Actions.
    const message = err instanceof Error ? err.message : "error desconocido";
    console.error("[cron/prospects]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
