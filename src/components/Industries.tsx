"use client";

const industries = [
  {
    name: "Supermercados",
    description: "Terminales POS de alto tráfico, lectores omnidireccionales y cajones reforzados para operación continua.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12" aria-hidden="true">
        <path d="M6 18l18-12 18 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="10" y="18" width="28" height="22" stroke="currentColor" strokeWidth="2" />
        <rect x="18" y="28" width="12" height="12" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    name: "Restaurantes",
    description: "Smart POS táctiles resistentes a salpicaduras, impresoras térmicas rápidas para cocina y barra.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12" aria-hidden="true">
        <path d="M8 36h32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 36V20a12 12 0 0124 0v16" stroke="currentColor" strokeWidth="2" />
        <path d="M18 24h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Farmacias",
    description: "Lectores multi-código para prospectos y facturación IVA. Verificadores de precio para autogestión del cliente.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12" aria-hidden="true">
        <rect x="12" y="8" width="24" height="32" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M24 18v12M18 24h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Logística",
    description: "Lectores wireless de largo alcance, impresoras de etiquetas multi-lenguaje y Mini PCs para estaciones de trabajo.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12" aria-hidden="true">
        <rect x="6" y="10" width="20" height="16" rx="1" stroke="currentColor" strokeWidth="2" />
        <rect x="10" y="26" width="16" height="12" rx="1" stroke="currentColor" strokeWidth="2" />
        <rect x="26" y="16" width="16" height="16" rx="1" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    name: "Estaciones de Servicio",
    description: "Terminales POS versátiles para múltiples servicios, cajones de alta seguridad y lectores resistentes.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12" aria-hidden="true">
        <rect x="10" y="8" width="18" height="32" rx="2" stroke="currentColor" strokeWidth="2" />
        <rect x="14" y="12" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M28 20h6a2 2 0 012 2v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="36" cy="34" r="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    name: "Hotelería",
    description: "Smart POS elegantes para recepción, visores de cliente para facturación transparente y hardware discreto.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12" aria-hidden="true">
        <rect x="8" y="16" width="32" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M8 28h32" stroke="currentColor" strokeWidth="1.5" />
        <path d="M16 16V12a8 8 0 0116 0v4" stroke="currentColor" strokeWidth="2" />
        <rect x="20" y="30" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

export default function Industries() {
  return (
    <section id="industrias" className="relative py-24 lg:py-32 bg-forcom-dark">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="reveal text-center mb-16 lg:mb-20">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-[2px] bg-forcom-red" />
            <span className="font-display font-semibold text-xs tracking-[0.3em] uppercase text-forcom-red">
              Sectores
            </span>
            <div className="w-8 h-[2px] bg-forcom-red" />
          </div>
          <h2 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight text-white mb-4">
            Industrias que confían
            <br />
            en FORCOM
          </h2>
          <p className="text-forcom-gray-light text-lg max-w-2xl mx-auto">
            Soluciones específicas para cada vertical. Entendemos los desafíos operativos de su industria.
          </p>
        </div>

        {/* Industries grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {industries.map((ind, i) => (
            <div
              key={ind.name}
              className="reveal group relative p-8 lg:p-10 bg-forcom-card border border-forcom-border rounded-sm hover:border-forcom-red/40 transition-all duration-300 overflow-hidden"
              style={{ transitionDelay: `${i * 0.08}s` }}
            >
              {/* Hover glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-forcom-red/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative">
                <div className="text-forcom-gray group-hover:text-forcom-red transition-colors duration-300 mb-6">
                  {ind.icon}
                </div>
                <h3 className="font-display font-bold text-2xl tracking-tight text-white mb-3">
                  {ind.name}
                </h3>
                <p className="text-sm text-forcom-gray leading-relaxed">
                  {ind.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
