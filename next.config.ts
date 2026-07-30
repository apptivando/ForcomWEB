import type { NextConfig } from "next";

// URL del deploy de Vercel del CRM de WhatsApp (fork de wacrm, repo
// apptivando/ForcomCRM). Se proxea 1 a 1 bajo /admin/crm — wacrm ya está
// configurado con basePath: "/admin/crm", así que sus propias rutas y
// assets (/_next/static/...) ya vienen con ese prefijo, sin necesidad de
// reescribirlo acá.
const WACRM_DEPLOYMENT_URL =
  process.env.WACRM_DEPLOYMENT_URL || "https://forcom-crm.vercel.app";

const nextConfig: NextConfig = {
  async rewrites() {
    // `beforeFiles`: tiene que ganarle a la página propia /admin/crm
    // (el buzón viejo, todavía no retirado — ver Track C del plan). Con
    // el array plano por defecto (afterFiles), Next.js prioriza la
    // página del filesystem y el rewrite nunca se activaría.
    return {
      beforeFiles: [
        {
          source: "/admin/crm",
          destination: `${WACRM_DEPLOYMENT_URL}/admin/crm`,
        },
        {
          source: "/admin/crm/:path*",
          destination: `${WACRM_DEPLOYMENT_URL}/admin/crm/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
