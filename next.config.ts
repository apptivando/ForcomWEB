import type { NextConfig } from "next";

// Acá vivía el proxy /admin/crm/* hacia el fork de wacrm, que se
// discontinuó el 06/08/2026 — el CRM de WhatsApp ahora se construye
// dentro de este repo (Track E). Con el rewrite fuera, /admin/crm
// vuelve a servir la página propia del repo.
const nextConfig: NextConfig = {
  async redirects() {
    return [
      // URL estándar de "cambiar contraseña" (W3C Change Password URL). Los
      // gestores —Dashlane, 1Password, el de Chrome— la piden cuando ofrecen
      // "cambiar esta contraseña" desde su propia interfaz. Sin esto, ese
      // botón lleva a la home y la persona tiene que buscar la pantalla sola.
      {
        source: "/.well-known/change-password",
        destination: "/admin/cuenta",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
