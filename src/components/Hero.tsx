"use client";

import type { HeroContent } from "@/lib/types";

const DEFAULTS = {
  badge_text: "Soluciones POS & Retail Tech",
  headline_line1: "Tecnología",
  headline_line2: "que entiende",
  headline_red: "su negocio",
  subheadline:
    "Hardware de grado empresarial para punto de venta, logística y retail. Terminales inteligentes, impresoras de alta velocidad y soluciones de escaneo que transforman su operación.",
  cta_primary: "Ver productos",
  cta_secondary: "Contactar ventas",
  trust_item_1: "Soporte técnico local",
  trust_item_2: "Garantía directa",
  trust_item_3: "Envío a todo el país",
  hero_image_url: null as string | null,
};

export default function Hero({ data }: { data?: HeroContent | null }) {
  const h = { ...DEFAULTS, ...data };

  return (
    <section className="relative min-h-screen flex items-start hero-gradient grid-bg overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-20 right-10 w-72 h-72 border border-forcom-border/30 rounded-full opacity-20" />
      <div className="absolute bottom-20 left-10 w-48 h-48 border border-forcom-red/10 rounded-full opacity-30" />
      <div className="absolute top-1/2 right-1/4 w-1 h-32 bg-gradient-to-b from-forcom-red/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 w-full pt-20 md:pt-24 lg:pt-36 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="order-2 md:order-1 max-w-xl">
            {/* Eyebrow */}
            <div className="animate-fade-in-up hidden sm:flex items-center gap-3 mb-4 md:mb-6" style={{ animationDelay: "0.1s" }}>
              <div className="w-8 h-[2px] bg-forcom-red" />
              <span className="font-display font-semibold text-xs tracking-[0.3em] uppercase text-forcom-red">
                {h.badge_text}
              </span>
            </div>

            {/* Headline */}
            <h1
              className="animate-fade-in-up font-display font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-7xl leading-[0.95] tracking-tight text-white mt-3 mb-4 sm:mt-0 md:mb-6 text-center sm:text-left"
              style={{ animationDelay: "0.25s" }}
            >
              <span className="sm:block">{h.headline_line1}{" "}</span>
              <span className="sm:block">{h.headline_line2}{" "}</span>
              <span className="sm:block text-forcom-red">{h.headline_red}</span>
            </h1>

            {/* Subhead */}
            <p
              className="animate-fade-in-up hidden sm:block text-forcom-gray-light text-base md:text-lg lg:text-xl leading-relaxed mb-5 md:mb-10 max-w-md"
              style={{ animationDelay: "0.4s" }}
            >
              {h.subheadline}
            </p>

            {/* CTAs */}
            <div className="animate-fade-in-up flex flex-col sm:flex-row gap-3 md:gap-4" style={{ animationDelay: "0.55s" }}>
              <a
                href="#productos"
                className="inline-flex items-center justify-center px-5 py-3 md:px-8 md:py-4 bg-forcom-red text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-forcom-red-dark transition-colors group"
              >
                {h.cta_primary}
                <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <a
                href="#contacto"
                className="inline-flex items-center justify-center px-5 py-3 md:px-8 md:py-4 border border-forcom-border text-white font-display font-semibold text-sm tracking-widest uppercase rounded-sm hover:border-forcom-red hover:text-forcom-red transition-colors"
              >
                {h.cta_secondary}
              </a>
            </div>

            {/* Trust bar */}
            <div className="animate-fade-in mt-5 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 text-forcom-gray text-xs sm:text-sm md:mt-6" style={{ animationDelay: "0.7s" }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                <span>{h.trust_item_1}</span>
              </div>
              <div className="w-px h-3 bg-forcom-border hidden sm:block" />
              <span>{h.trust_item_2}</span>
              <div className="w-px h-3 bg-forcom-border hidden sm:block" />
              <span>{h.trust_item_3}</span>
            </div>

            <a
              href="#productos"
              className="sm:hidden mt-6 flex flex-col items-center gap-1.5 text-forcom-gray/50 hover:text-forcom-gray transition-colors"
              aria-label="Ver productos"
            >
              <span className="font-display text-[10px] tracking-[0.25em] uppercase">Ver productos</span>
              <svg className="w-4 h-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </a>
          </div>

          {/* Right: imagen real o placeholder CSS */}
          <div className="animate-scale-in order-1 md:order-2 flex items-center justify-center" style={{ animationDelay: "0.5s" }}>
            <div className="relative w-80 h-80 md:w-full md:h-auto md:max-w-lg md:aspect-square mx-auto">
              <div className="absolute inset-0 border border-forcom-border/40 rounded-sm rotate-3" />
              {h.hero_image_url ? (
                /* Imagen real configurada desde el admin */
                <div className="absolute inset-2 md:inset-4 bg-gradient-to-br from-forcom-card to-forcom-dark rounded-sm border border-forcom-border/60 overflow-hidden flex items-center justify-center p-4 md:p-6">
                  <img
                    src={h.hero_image_url}
                    alt="Producto destacado FORCOM"
                    className="w-full h-full object-contain drop-shadow-2xl"
                  />
                </div>
              ) : (
                /* Placeholder geométrico (se muestra hasta que haya imagen real) */
                <div className="absolute inset-2 md:inset-4 bg-gradient-to-br from-forcom-card to-forcom-dark rounded-sm border border-forcom-border/60 flex items-center justify-center overflow-hidden">
                  <div className="relative w-48 h-64 flex flex-col items-center">
                    <div className="w-full h-40 bg-gradient-to-b from-forcom-border/30 to-forcom-black rounded-t-md border border-forcom-border/50 flex items-center justify-center">
                      <div className="w-3/4 h-3/4 bg-forcom-black/80 rounded-sm flex flex-col items-center justify-center gap-2 p-4">
                        <div className="w-full h-2 bg-forcom-red/40 rounded-full" />
                        <div className="w-4/5 h-2 bg-forcom-border/40 rounded-full" />
                        <div className="w-3/5 h-2 bg-forcom-border/30 rounded-full" />
                        <div className="mt-2 w-8 h-8 border border-forcom-red/40 rounded-sm flex items-center justify-center">
                          <div className="w-3 h-3 bg-forcom-red/60 rounded-sm" />
                        </div>
                      </div>
                    </div>
                    <div className="w-4/5 h-6 bg-gradient-to-b from-forcom-border/40 to-forcom-border/20 rounded-b-sm" />
                    <div className="w-1/3 h-16 bg-gradient-to-b from-forcom-border/30 to-forcom-border/10 rounded-b-sm" />
                  </div>
                  <div className="absolute top-6 -right-2 px-3 py-1.5 bg-forcom-red/10 border border-forcom-red/30 rounded-sm text-xs font-display font-semibold text-forcom-red tracking-wider">
                    INTEL CORE i7
                  </div>
                  <div className="absolute bottom-12 -left-2 px-3 py-1.5 bg-forcom-card border border-forcom-border rounded-sm text-xs font-display font-semibold text-forcom-gray tracking-wider">
                    18.5&quot; TOUCH
                  </div>
                </div>
              )}
              <div className="absolute -top-2 -left-2 w-6 h-6 border-t-2 border-l-2 border-forcom-red" />
              <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-2 border-r-2 border-forcom-red" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-forcom-red/30 to-transparent" />
    </section>
  );
}
