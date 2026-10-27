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
    ];
  },
};

export default nextConfig;
