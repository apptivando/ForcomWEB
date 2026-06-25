import ForcomLogo from "./ForcomLogo";

export default function Footer() {
  return (
    <footer className="bg-forcom-black border-t border-forcom-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 mb-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="mb-4">
              <ForcomLogo className="h-10 w-auto" />
            </div>
            <p className="text-sm text-forcom-gray leading-relaxed max-w-xs">
              Tecnología que entiende su negocio. Soluciones de hardware empresarial para punto de venta y retail.
            </p>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-display font-bold text-xs tracking-[0.2em] uppercase text-white mb-4">
              Productos
            </h4>
            <ul className="space-y-2.5">
              {["Smart POS", "Mini PC", "Impresoras Térmicas", "Impresora de Etiquetas", "Lectores de Código", "Verificadores de Precio", "Accesorios"].map(
                (item) => (
                  <li key={item}>
                    <a
                      href="#productos"
                      className="text-sm text-forcom-gray hover:text-forcom-red transition-colors"
                    >
                      {item}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Industries */}
          <div>
            <h4 className="font-display font-bold text-xs tracking-[0.2em] uppercase text-white mb-4">
              Industrias
            </h4>
            <ul className="space-y-2.5">
              {["Supermercados", "Restaurantes", "Farmacias", "Logística", "Estaciones de Servicio", "Hotelería"].map(
                (item) => (
                  <li key={item}>
                    <a
                      href="#industrias"
                      className="text-sm text-forcom-gray hover:text-forcom-red transition-colors"
                    >
                      {item}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-display font-bold text-xs tracking-[0.2em] uppercase text-white mb-4">
              Empresa
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: "Sobre nosotros", href: "#por-que" },
                { label: "Contacto", href: "#contacto" },
                { label: "Soporte técnico", href: "#contacto" },
                { label: "Garantía", href: "#contacto" },
              ].map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="text-sm text-forcom-gray hover:text-forcom-red transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-forcom-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-forcom-gray">
            &copy; {new Date().getFullYear()} FORCOM. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-forcom-gray hover:text-forcom-red transition-colors">
              Política de privacidad
            </a>
            <a href="#" className="text-xs text-forcom-gray hover:text-forcom-red transition-colors">
              Términos y condiciones
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
