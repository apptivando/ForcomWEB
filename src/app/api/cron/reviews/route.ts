import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reviewBatch } from "@/lib/analysis/reviewer";

/**
 * Análisis de las conversaciones de los vendedores.
 *
 * Lo dispara el mismo workflow de GitHub Actions que ya llama a los otros dos
 * crons, con el mismo `CRON_SECRET`.
 *
 * Dos trabajos en el mismo endpoint:
 *
 * 1. **Encolar el día anterior**, una sola vez. La condición horaria es lo que
 *    lo hace "nocturno" sin necesitar un scheduler aparte: el workflow corre
 *    cada 5 minutos, y este bloque solo actúa pasada la hora configurada. La
 *    función de encolado es idempotente, así que si corre de más no duplica.
 *
 * 2. **Procesar un lote de la cola**, en cada corrida. Mismo patrón que el
 *    enriquecedor de prospectos: reclamo atómico, presupuesto de tiempo y
 *    watchdog. Así el análisis se reparte a lo largo de la mañana en vez de
 *    intentar hacer todo en una sola llamada de 200 conversaciones.
 */

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Hora (UTC) a partir de la cual se encola el día anterior. 06:00 UTC = 3 AM en Argentina. */
const ENQUEUE_HOUR_UTC = 6;
const TIME_BUDGET_MS = 240_000;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 6, 1), 20);
  // `?enqueue=1` fuerza el encolado sin esperar a la hora, para poder probarlo.
  const forceEnqueue = req.nextUrl.searchParams.get("enqueue") === "1";

  try {
    let enqueued = 0;
    if (forceEnqueue || new Date().getUTCHours() >= ENQUEUE_HOUR_UTC) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data } = await db.rpc("enqueue_conversation_reviews", { p_day: yesterday });
      enqueued = Number(data) || 0;
    }

    const result = await reviewBatch(db, { limit, deadline: Date.now() + TIME_BUDGET_MS });

    return NextResponse.json({ ok: true, enqueued, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error desconocido";
    console.error("[cron/reviews]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
