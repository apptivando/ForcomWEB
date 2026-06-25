"use client";

const categories = [
  {
    title: "Smart POS",
    subtitle: "Terminales Inteligentes",
    description: "Terminales todo-en-uno con pantalla táctil, procesadores de última generación y conectividad avanzada.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden="true">
        <rect x="8" y="4" width="32" height="28" rx="2" stroke="currentColor" strokeWidth="2" />
        <rect x="12" y="8" width="24" height="18" rx="1" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M20 36h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M18 40h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    count: "2 modelos",
  },
  {
    title: "Mini PC",
    subtitle: "Computación Compacta",
    description: "Potencia de escritorio en formato ultracompacto. Triple salida de video y conectividad dual LAN.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden="true">
        <rect x="6" y="14" width="36" height="20" rx="3" stroke="currentColor" strokeWidth="2" />
        <circle cx="16" cy="24" r="3" stroke="currentColor" strokeWidth="1.5" />
        <rect x="24" y="21" width="12" height="2" rx="1" fill="currentColor" opacity="0.3" />
        <rect x="24" y="25" width="8" height="2" rx="1" fill="currentColor" opacity="0.3" />
      </svg>
    ),
    count: "1 modelo",
  },
  {
    title: "Impresoras",
    subtitle: "Térmica & Etiquetas",
    description: "Impresión de alta velocidad para tickets, recibos y etiquetas. Compatible con todos los sistemas POS.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden="true">
        <rect x="10" y="16" width="28" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M14 16V10a2 2 0 012-2h16a2 2 0 012 2v6" stroke="currentColor" strokeWidth="2" />
        <path d="M14 30v8h20v-8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
        <rect x="18" y="22" width="12" height="2" rx="1" fill="currentColor" opacity="0.3" />
      </svg>
    ),
    count: "3 modelos",
  },
  {
    title: "Lectores",
    subtitle: "Códigos de Barra & QR",
    description: "Lectores omnidireccionales, inalámbricos e industriales. Lectura de QR desde pantallas de celular.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden="true">
        <rect x="8" y="8" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="2" />
        <rect x="30" y="8" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="2" />
        <rect x="8" y="30" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="2" />
        <rect x="30" y="30" width="4" height="4" fill="currentColor" opacity="0.3" />
        <rect x="36" y="30" width="4" height="4" fill="currentColor" opacity="0.3" />
        <rect x="30" y="36" width="4" height="4" fill="currentColor" opacity="0.3" />
        <path d="M22 24h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    count: "7 modelos",
  },
  {
    title: "Verificadores",
    subtitle: "Kioscos de Precio",
    description: "Kioscos de autoservicio con pantalla táctil y lector integrado. Windows y Android disponibles.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden="true">
        <rect x="12" y="4" width="24" height="36" rx="2" stroke="currentColor" strokeWidth="2" />
        <rect x="16" y="8" width="16" height="20" rx="1" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="24" cy="34" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 42h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    count: "2 modelos",
  },
  {
    title: "Accesorios",
    subtitle: "Cajones & Visores",
    description: "Cajones de dinero de acero reforzado y visores de cliente LCD para una operación completa.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden="true">
        <rect x="6" y="18" width="36" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M6 24h36" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        <rect x="14" y="22" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="26" y="22" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M20 18v-4a2 2 0 012-2h4a2 2 0 012 2v4" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    count: "2 modelos",
  },
  {
    title: "Balanzas",
    subtitle: "Pesaje Comercial",
    description: "Balanzas con display dual, teclado PLU e impresora de etiquetas integrada. Ideales para carnicerías, verdulerías y supermercados.",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden="true">
        <rect x="8" y="32" width="32" height="4" rx="1" stroke="currentColor" strokeWidth="2" />
        <rect x="14" y="36" width="20" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M24 32V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 20h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 20l4-8h16l4 8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="10" y="24" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.1" />
      </svg>
    ),
    count: "1 modelo",
  },
];

export default function ProductCategories() {
  return (
    <section id="productos" className="relative py-24 lg:py-32 bg-forcom-black">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section header */}
        <div className="reveal mb-16 lg:mb-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-[2px] bg-forcom-red" />
            <span className="font-display font-semibold text-xs tracking-[0.3em] uppercase text-forcom-red">
              Catálogo de Productos
            </span>
          </div>
          <h2 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight text-white red-line">
            Equipamiento
            <br />
            de precisión
          </h2>
        </div>

        {/* Category grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {categories.map((cat, i) => (
            <a
              key={cat.title}
              href={`#cat-${cat.title.toLowerCase().replace(/\s+/g, "-")}`}
              className="reveal category-card group relative p-6 lg:p-8 bg-forcom-card border border-forcom-border rounded-sm overflow-hidden"
              style={{ transitionDelay: `${i * 0.08}s` }}
            >
              {/* Top accent line */}
              <div className="absolute top-0 left-0 w-0 h-[2px] bg-forcom-red transition-all duration-500 group-hover:w-full" />

              {/* Icon */}
              <div className="text-forcom-gray group-hover:text-forcom-red transition-colors mb-5">
                {cat.icon}
              </div>

              {/* Title */}
              <h3 className="font-display font-bold text-2xl tracking-tight text-white mb-1">
                {cat.title}
              </h3>
              <p className="font-display font-medium text-xs tracking-[0.2em] uppercase text-forcom-red mb-3">
                {cat.subtitle}
              </p>

              {/* Description */}
              <p className="text-sm text-forcom-gray leading-relaxed mb-4">
                {cat.description}
              </p>

              {/* Count + arrow */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-display font-semibold tracking-wider uppercase text-forcom-gray">
                  {cat.count}
                </span>
                <svg
                  className="w-5 h-5 text-forcom-border group-hover:text-forcom-red group-hover:translate-x-1 transition-all"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
