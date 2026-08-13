import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processPendingExecutions } from "@/lib/automations/engine";

// Vercel Cron llama acá cada 5 min (ver vercel.json) y manda
// automáticamente el header Authorization con CRON_SECRET cuando esa
// variable está configurada — así nadie más puede disparar esto.
//
// Ojo: los Cron Jobs de Vercel solo corren contra deploys de
// Production, no Preview — mientras el Track E siga en `develop`, los
// pasos "wait" de las automatizaciones no se van a completar solos en
// el ambiente de pruebas (todo lo demás sí funciona igual).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const processed = await processPendingExecutions(db);

  return NextResponse.json({ ok: true, processed });
}
