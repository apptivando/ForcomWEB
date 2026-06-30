"use client";

import { useState, useEffect, useRef } from "react";
import type { HeroSlide } from "@/lib/types";

const FALLBACK: HeroSlide[] = [
  {
    id: "f1",
    badge_text: "Smart POS — Terminales Inteligentes",
    headline_line1: "Tecnología",
    headline_line2: "que entiende",
    headline_accent: "su negocio",
    subheadline: 'Terminales con Intel Core i5/i7 y pantalla capacitiva 15"-18.5". Diseñadas para restaurantes, supermercados y retail de alto volumen.',
    cta_label: "Ver terminales",
    cta_category: "cat-smart-pos",
    cta_url: null,
    image_url: "/images/products/forcom-a6.png",
    image_alt: "FORCOM A6 G2 Smart-POS",
    image_tag: 'INTEL CORE i7 · 18.5" TOUCH',
    active: true,
    order_index: 0,
    created_at: "",
    updated_at: "",
  },
  {
    id: "f2",
    badge_text: "Impresoras Térmicas de Alto Volumen",
    headline_line1: "Velocidad",
    headline_line2: "que impulsa",
    headline_accent: "su operación",
    subheadline: "300mm/s y 150km de vida útil del cabezal. Impresión sin interrupciones para checkouts de alto tráfico y logística.",
    cta_label: "Ver impresoras",
    cta_category: "cat-impresoras",
    cta_url: null,
    image_url: "/images/products/forcom-tk300.png",
    image_alt: "FORCOM TK-300 Impresora Térmica",
    image_tag: "300MM/S · 150KM CABEZAL",
    active: true,
    order_index: 1,
    created_at: "",
    updated_at: "",
  },
  {
    id: "f3",
    badge_text: "Lectores de Código 1D & 2D",
    headline_line1: "Precisión",
    headline_line2: "en cada",
    headline_accent: "escaneo",
    subheadline: "120 FPS, 100m de alcance inalámbrico. Compatible con QR de Mercado Pago, WeChat, Alipay y todas las apps de cobro digital.",
    cta_label: "Ver lectores",
    cta_category: "cat-lectores",
    cta_url: null,
    image_url: "/images/products/forcom-8066.png",
    image_alt: "FORCOM 8066 Lector Wireless",
    image_tag: "BT + 2.4G · 100M ALCANCE",
    active: true,
    order_index: 2,
    created_at: "",
    updated_at: "",
  },
  {
    id: "f4",
    badge_text: "Kioscos de Autoservicio",
    headline_line1: "Autoservicio",
    headline_line2: "que reduce",
    headline_accent: "las colas",
    subheadline: 'Pantalla táctil 11.6", Windows 10 o Android 11. Verificación de precios integrada a su sistema de gestión.',
    cta_label: "Ver kioscos",
    cta_category: "cat-verificadores",
    cta_url: null,
    image_url: "/images/products/forcom-vx4-windows.png",
    image_alt: "FORCOM VX4 Verificador de Precio",
    image_tag: 'PANTALLA 11.6" · INTEL i3',
    active: true,
    order_index: 3,
    created_at: "",
    updated_at: "",
  },
];

const INTERVAL = 5500;
const FADE_DURATION = 350;

export default function HeroCarousel({ slides: dbSlides }: { slides?: HeroSlide[] | null }) {
  const slides = dbSlides && dbSlides.length > 0 ? dbSlides : FALLBACK;

  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slide = slides[current] ?? slides[0];
  const ctaHref = slide.cta_url || (slide.cta_category ? `#${slide.cta_category}` : "#productos");

  const startInterval = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (transitionRef.current) return;
      setVisible(false);
      transitionRef.current = setTimeout(() => {
        setCurrent((c) => (c + 1) % slides.length);
        setVisible(true);
        transitionRef.current = null;
      }, FADE_DURATION);
    }, INTERVAL);
  };

  useEffect(() => {
    startInterval();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (transitionRef.current) clearTimeout(transitionRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  const goTo = (idx: number) => {
    if (idx === current || transitionRef.current) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setVisible(false);
    transitionRef.current = setTimeout(() => {
      setCurrent(idx);
      setVisible(true);
      transitionRef.current = null;
      startInterval();
    }, FADE_DURATION);
  };

  const pause = () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  const resume = () => { startInterval(); };

  return (
    <section
      className="relative h-screen flex items-start md:items-center overflow-hidden bg-forcom-black grid-bg"
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      {/* Background accents */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(232,35,26,0.07)] via-transparent to-transparent" />
        <div className="absolute top-20 right-10 w-72 h-72 border border-forcom-border/30 rounded-full opacity-20" />
        <div className="absolute bottom-20 left-10 w-48 h-48 border border-forcom-red/10 rounded-full opacity-30" />
        <div className="absolute top-1/2 right-1/4 w-1 h-32 bg-gradient-to-b from-forcom-red/20 to-transparent" />
      </div>

      {/* Main content — centered vertically, bottom-padded to clear the nav bar */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full pt-20 md:pt-24 lg:pt-36 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-12 lg:gap-16 items-center">

          {/* Left — Text */}
          <div
            className="order-2 md:order-1 max-w-xl"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(20px)",
              transition: `opacity ${FADE_DURATION}ms ease-in-out, transform ${FADE_DURATION}ms ease-in-out`,
            }}
          >
            <div className="hidden sm:flex items-center gap-3 mb-4 md:mb-6">
              <div className="w-8 h-[2px] bg-forcom-red flex-shrink-0" />
              <span className="font-display font-semibold text-xs tracking-[0.3em] uppercase text-forcom-red">
                {slide.badge_text}
              </span>
            </div>

            <h1 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-7xl leading-[0.95] tracking-tight text-white mt-3 mb-4 sm:mt-0 md:mb-6 text-center sm:text-left">
              <span className="sm:block">{slide.headline_line1}{" "}</span>
              <span className="sm:block">{slide.headline_line2}{" "}</span>
              <span className="sm:block text-forcom-red">{slide.headline_accent}</span>
            </h1>

            <p className="hidden sm:block text-forcom-gray-light text-base md:text-lg lg:text-xl leading-relaxed mb-5 md:mb-10 max-w-md">
              {slide.subheadline}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <a
                href={ctaHref}
                className="inline-flex items-center justify-center px-5 py-3 md:px-8 md:py-4 bg-forcom-red text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-forcom-red-dark transition-colors group"
              >
                {slide.cta_label}
                <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <a
                href="#contacto"
                className="inline-flex items-center justify-center px-5 py-3 md:px-8 md:py-4 border border-forcom-border text-white font-display font-semibold text-sm tracking-widest uppercase rounded-sm hover:border-forcom-red hover:text-forcom-red transition-colors"
              >
                Contactar ventas
              </a>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 text-forcom-gray text-xs sm:text-sm md:mt-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                <span>Soporte técnico local</span>
              </div>
              <div className="w-px h-3 bg-forcom-border hidden sm:block" />
              <span>Garantía directa</span>
              <div className="w-px h-3 bg-forcom-border hidden sm:block" />
              <span>Envío a todo el país</span>
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

          {/* Right — Product image */}
          {slide.image_url && (
            <div
              className="order-1 md:order-2 flex items-center justify-center"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "scale(1)" : "scale(0.97)",
                transition: `opacity ${FADE_DURATION}ms ease-in-out, transform ${FADE_DURATION}ms ease-in-out`,
              }}
            >
              <div className="relative w-80 h-80 md:w-full md:h-auto md:max-w-lg md:aspect-square mx-auto">
                <div className="absolute inset-0 border border-forcom-border/40 rounded-sm rotate-3" />
                <div className="absolute inset-2 md:inset-4 bg-gradient-to-br from-forcom-card to-forcom-dark rounded-sm border border-forcom-border/60 overflow-hidden flex items-center justify-center p-4 md:p-8">
                  <img src={slide.image_url} alt={slide.image_alt} className="w-full h-full object-contain drop-shadow-2xl" />
                </div>
                <div className="absolute -top-2 -left-2 w-6 h-6 border-t-2 border-l-2 border-forcom-red" />
                <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-2 border-r-2 border-forcom-red" />
                {slide.image_tag && (
                  <div className="absolute top-6 -right-3 px-3 py-1.5 bg-forcom-red/10 border border-forcom-red/30 rounded-sm text-xs font-display font-semibold text-forcom-red tracking-wider whitespace-nowrap">
                    {slide.image_tag}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation — absolutely pinned to bottom so it's always visible */}
      <div className="absolute bottom-6 left-0 right-0 z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center gap-3">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Ir al slide ${i + 1}`}
              className={`transition-all duration-500 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forcom-red ${
                i === current ? "w-8 h-2 bg-forcom-red" : "w-2 h-2 bg-forcom-border hover:bg-forcom-gray"
              }`}
            />
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => goTo((current - 1 + slides.length) % slides.length)}
              aria-label="Slide anterior"
              className="w-10 h-10 border border-forcom-border flex items-center justify-center rounded-sm hover:border-forcom-red hover:text-forcom-red text-forcom-gray transition-colors"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => goTo((current + 1) % slides.length)}
              aria-label="Slide siguiente"
              className="w-10 h-10 border border-forcom-border flex items-center justify-center rounded-sm hover:border-forcom-red hover:text-forcom-red text-forcom-gray transition-colors"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <span className="ml-4 font-display text-xs tracking-widest tabular-nums text-forcom-gray">
            <span className="text-white font-bold">{String(current + 1).padStart(2, "0")}</span>
            {" / "}
            {String(slides.length).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* Auto-advance progress bar */}
      <div key={`prog-${current}`} className="absolute bottom-0 left-0 h-[2px] bg-forcom-red/70 hero-progress" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-forcom-red/20 to-transparent" />
    </section>
  );
}
