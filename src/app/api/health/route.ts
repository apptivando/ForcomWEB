import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Qué deploy está corriendo y qué variables hay cargadas (nunca sus valores). */
export function GET() {
  const vars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_KEY",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "RESEND_TO_EMAIL",
    "NEXT_PUBLIC_GA_ID",
  ];
  return NextResponse.json({
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    env: Object.fromEntries(vars.map((v) => [v, Boolean(process.env[v])])),
  });
}
