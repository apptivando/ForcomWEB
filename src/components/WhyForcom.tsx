"use client";

const differentiators = [
  {
    title: "Hardware Robusto",
    description:
      "Equipos diseñados para operación continua 24/7. Chasis de aluminio, grado industrial IP54, y componentes seleccionados para máxima durabilidad.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" aria-hidden="true">
        <path d="M20 4l14 8v16l-14 8L6 28V12l14-8z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M20 4v16m0 0l14-8m-14 8L6 12" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      </svg>
    ),
  },
  {
    title: "Multi-OS Compatible",
    description:
      "Soluciones que funcionan con Windows, Android y Linux. Integración sin fricciones con cualquier software POS del mercado.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" aria-hidden="true">
        <rect x="4" y="8" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="22" y="8" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="4" y="22" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="22" y="22" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "Diseño Modular",
    description:
      "Componentes intercambiables y expandibles. RAM ampliable, múltiples puertos y opciones de montaje para adaptar cada equipo a su necesidad.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" aria-hidden="true">
        <rect x="14" y="4" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="4" y="24" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="24" y="24" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M20 16v8M10 24l6-4M30 24l-6-4" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      </svg>
    ),
  },
  {
    title: "Versatilidad Industrial",
    description:
      "De la farmacia al supermercado, del restaurante a la estación de servicio. Cada producto está pensado para los desafíos reales de cada industria.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" aria-hidden="true">
        <circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="1.5" />
        <path d="M20 5v30M5 20h30" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        <circle cx="20" cy="20" r="6" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Soporte Local",
    description:
      "Equipo técnico en Argentina con respuesta rápida. Garantía directa del fabricante, sin intermediarios ni demoras.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" aria-hidden="true">
        <path d="M20 36c8.837 0 16-5.373 16-12S28.837 12 20 12 4 17.373 4 24s7.163 12 16 12z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 4h12M20 4v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="20" cy="24" r="3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "Envío Nacional",
    description:
      "Cobertura logística en todo el país. Stock disponible para despacho inmediato en los productos más demandados.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" aria-hidden="true">
        <path d="M4 28h24V12H4v16z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M28 18h6l2 6v4h-8V18z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="30" r="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="32" cy="30" r="3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

export default function WhyForcom() {
  return (
    <section id="por-que" className="relative py-24 lg:py-32 bg-forcom-black overflow-hidden">
      {/* Background accent */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-forcom-red/[0.02] to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
        {/* Header */}
        <div className="reveal grid lg:grid-cols-2 gap-8 lg:gap-16 mb-16 lg:mb-20">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-[2px] bg-forcom-red" />
              <span className="font-display font-semibold text-xs tracking-[0.3em] uppercase text-forcom-red">
                Diferenciadores
              </span>
            </div>
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight text-white red-line">
              Por qué
              <br />
              FORCOM
            </h2>
          </div>
          <div className="flex items-end">
            <p className="text-forcom-gray-light text-lg leading-relaxed max-w-md">
              No somos un revendedor genérico. Somos su socio tecnológico: seleccionamos, probamos y respaldamos cada equipo que lleva nuestra marca.
            </p>
          </div>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-forcom-border/30 rounded-sm overflow-hidden">
          {differentiators.map((item, i) => (
            <div
              key={item.title}
              className="reveal bg-forcom-black p-8 lg:p-10 group hover:bg-forcom-card transition-colors duration-300"
              style={{ transitionDelay: `${i * 0.06}s` }}
            >
              <div className="text-forcom-gray group-hover:text-forcom-red transition-colors mb-6">
                {item.icon}
              </div>
              <h3 className="font-display font-bold text-xl tracking-tight text-white mb-3">
                {item.title}
              </h3>
              <p className="text-sm text-forcom-gray leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
