import type { NextConfig } from "next";

// Acá vivía el proxy /admin/crm/* hacia el fork de wacrm, que se
// discontinuó el 06/08/2026 — el CRM de WhatsApp ahora se construye
// dentro de este repo (Track E). Con el rewrite fuera, /admin/crm
// vuelve a servir la página propia del repo.
const nextConfig: NextConfig = {};

export default nextConfig;
