"use client";

import { useState, useEffect, useRef } from "react";
import ForcomLogo from "./ForcomLogo";

const productCategories = [
  { label: "Smart POS", sub: "Terminales Inteligentes", href: "#cat-smart-pos" },
  { label: "Mini PC", sub: "Computación Compacta", href: "#cat-mini-pc" },
  { label: "Impresoras", sub: "Térmica & Etiquetas", href: "#cat-impresoras" },
  { label: "Lectores Escritorio", sub: "Omnidireccionales 1D/2D", href: "#cat-lectores" },
  { label: "Lectores de Mano", sub: "Wireless & USB", href: "#cat-lectores-mano" },
  { label: "Verificadores", sub: "Kioscos Autoservicio", href: "#cat-verificadores" },
  { label: "Balanzas", sub: "Comercio & Retail", href: "#cat-balanzas" },
  { label: "Accesorios", sub: "Cajones, Visores & Más", href: "#cat-accesorios" },
];

const navLinks = [
  { label: "Por qué FORCOM", href: "#por-que" },
  { label: "Industrias", href: "#industrias" },
  { label: "Contacto", href: "#contacto" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProductsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-forcom-black/95 backdrop-blur-md border-b border-forcom-border"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between h-16 lg:h-20">
        {/* Logo */}
        <a href="#" className="group flex-shrink-0">
          <ForcomLogo className="h-8 lg:h-9 w-auto group-hover:opacity-90 transition-opacity" />
        </a>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-8">
          {/* Productos dropdown */}
          <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={() => setProductsOpen(true)}
            onMouseLeave={() => setProductsOpen(false)}
          >
            <button
              onClick={() => setProductsOpen(!productsOpen)}
              aria-expanded={productsOpen}
              className="font-display font-semibold text-sm tracking-[0.12em] uppercase text-forcom-gray-light hover:text-white transition-colors py-[13px] flex items-center gap-1.5 focus-visible:outline-none focus-visible:text-white"
            >
              Productos
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                className={`transition-transform duration-200 ${productsOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Dropdown panel */}
            <div
              role="menu"
              className={`absolute top-full left-1/2 -translate-x-1/2 mt-0 w-[520px] bg-forcom-dark border border-forcom-border rounded-sm shadow-2xl shadow-black/50 transition-all duration-200 ${
                productsOpen
                  ? "opacity-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 -translate-y-2 pointer-events-none"
              }`}
            >
              {/* Top accent line */}
              <div className="h-[2px] w-full bg-gradient-to-r from-forcom-red via-forcom-red/50 to-transparent rounded-t-sm" />

              <div className="p-3 grid grid-cols-2 gap-1">
                {productCategories.map((cat) => (
                  <a
                    key={cat.href}
                    href={cat.href}
                    role="menuitem"
                    onClick={() => setProductsOpen(false)}
                    className="flex flex-col px-4 py-3 rounded-sm hover:bg-forcom-card group transition-colors"
                  >
                    <span className="font-display font-bold text-sm text-white group-hover:text-forcom-red transition-colors tracking-wide">
                      {cat.label}
                    </span>
                    <span className="text-xs text-forcom-gray mt-0.5 leading-tight">{cat.sub}</span>
                  </a>
                ))}
              </div>

              <div className="border-t border-forcom-border px-5 py-3">
                <a
                  href="#productos"
                  onClick={() => setProductsOpen(false)}
                  className="text-xs font-display font-bold text-forcom-red tracking-[0.2em] uppercase hover:text-forcom-red-dark transition-colors"
                >
                  Ver todos los productos →
                </a>
              </div>
            </div>
          </div>

          {/* Regular links */}
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-display font-semibold text-sm tracking-[0.12em] uppercase text-forcom-gray-light hover:text-white transition-colors relative py-[13px] after:absolute after:bottom-[9px] after:left-0 after:h-[2px] after:w-0 after:bg-forcom-red after:transition-all hover:after:w-full"
            >
              {link.label}
            </a>
          ))}

          <a
            href="#contacto"
            className="ml-4 px-6 py-3 bg-forcom-red text-white font-display font-bold text-sm tracking-[0.1em] uppercase rounded-sm hover:bg-forcom-red-dark transition-colors"
          >
            Consultá ahora
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="lg:hidden flex flex-col gap-1.5 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forcom-red rounded-sm"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={mobileOpen}
        >
          <span
            className={`block w-6 h-0.5 bg-white transition-all duration-300 ${
              mobileOpen ? "rotate-45 translate-y-2" : ""
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-white transition-all duration-300 ${
              mobileOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-white transition-all duration-300 ${
              mobileOpen ? "-rotate-45 -translate-y-2" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-forcom-dark border-t border-forcom-border">
          <div className="px-6 py-6 flex flex-col">
            {/* Products accordion */}
            <div className="border-b border-forcom-border/50">
              <button
                onClick={() => setMobileProductsOpen(!mobileProductsOpen)}
                className="w-full flex items-center justify-between font-display font-semibold text-base tracking-[0.12em] uppercase text-forcom-gray-light hover:text-white transition-colors py-4"
              >
                Productos
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  className={`transition-transform duration-200 ${mobileProductsOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {mobileProductsOpen && (
                <div className="ml-4 mb-4 pl-4 border-l border-forcom-border flex flex-col gap-0.5">
                  {productCategories.map((cat) => (
                    <a
                      key={cat.href}
                      href={cat.href}
                      onClick={() => setMobileOpen(false)}
                      className="font-display font-semibold text-sm tracking-wide text-forcom-gray hover:text-white hover:text-forcom-red transition-colors py-2.5"
                    >
                      {cat.label}
                      <span className="ml-2 text-xs text-forcom-gray/60 font-normal tracking-normal">
                        {cat.sub}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="font-display font-semibold text-base tracking-[0.12em] uppercase text-forcom-gray-light hover:text-white transition-colors py-4 border-b border-forcom-border/50"
              >
                {link.label}
              </a>
            ))}

            <a
              href="#contacto"
              onClick={() => setMobileOpen(false)}
              className="mt-5 px-5 py-3.5 bg-forcom-red text-white font-display font-bold text-sm tracking-[0.1em] uppercase rounded-sm text-center hover:bg-forcom-red-dark transition-colors"
            >
              Consultá ahora
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
