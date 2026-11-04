import type { NextConfig } from "next";

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
      // 04/11/2026: las secciones del panel tomaron los nombres de Latin Office
      // (Portada, Mensajes). Las direcciones viejas siguen andando para los
      // favoritos y los links de correos ya mandados (`?m=<id>` se conserva).
      { source: "/admin/hero", destination: "/admin/portada", permanent: true },
      { source: "/admin/crm", destination: "/admin/mensajes", permanent: true },
    ];
  },
};

export default nextConfig;
