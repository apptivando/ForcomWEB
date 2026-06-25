"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import ProductSpecsModal from "@/components/ProductSpecsModal";

interface ProductGroup {
  section: string;
  id: string;
  items: Product[];
}

// Datos hardcodeados como fallback si la DB no responde
const FALLBACK: ProductGroup[] = [
  {
    section: "Smart POS — Terminales Inteligentes",
    id: "cat-smart-pos",
    items: [
      { id: "f1", model: "A6 G2 Smart-POS", category: "Terminal Flagship", section: "Smart POS — Terminales Inteligentes", section_id: "cat-smart-pos", badge: "PREMIUM", image_url: "/images/products/forcom-a6.png", images: [], videos: [], description: null, full_specs: null, files: [], specs: ['Pantalla táctil capacitiva 18.5"', "Chasis de aluminio, Intel Core i7", "16GB RAM · 256GB SSD", "WiFi dual-band · Ideal para restaurantes y retail"], active: true, order_index: 1, created_at: "", updated_at: "" },
      { id: "f2", model: "T5 Smart-POS", category: "Terminal Versátil", section: "Smart POS — Terminales Inteligentes", section_id: "cat-smart-pos", badge: null, image_url: "/images/products/forcom-t5.png", images: [], videos: [], description: null, full_specs: null, files: [], specs: ['Pantalla táctil capacitiva 15"', "ABS + metal, Intel Core i5", "8GB RAM · 256GB SSD", "Supermercados, restaurantes, estaciones de servicio"], active: true, order_index: 2, created_at: "", updated_at: "" },
    ],
  },
];

function groupBySection(products: Product[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>();
  for (const p of products) {
    if (!map.has(p.section_id)) {
      map.set(p.section_id, { section: p.section, id: p.section_id, items: [] });
    }
    map.get(p.section_id)!.items.push(p);
  }
  return Array.from(map.values());
}

export default function ProductCards({ products }: { products?: Product[] | null }) {
  const groups = products && products.length > 0 ? groupBySection(products) : FALLBACK;
  const [selected, setSelected] = useState<Product | null>(null);

  return (
    <>
      <section id="productos" className="relative py-24 lg:py-32 bg-forcom-dark grid-bg">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {groups.map((group) => (
            <div key={group.id} id={group.id} className="mb-20 last:mb-0 scroll-mt-24 lg:scroll-mt-28">
              {/* Group header */}
              <div className="reveal mb-10">
                <h3 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-white">
                  {group.section}
                </h3>
                <div className="w-12 h-[2px] bg-forcom-red mt-4" />
              </div>

              {/* Cards grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {group.items.map((product, i) => (
                  <div
                    key={product.id}
                    className="reveal product-card relative bg-forcom-card border border-forcom-border rounded-sm p-6 lg:p-7 overflow-hidden group"
                    style={{ transitionDelay: `${i * 0.06}s` }}
                  >
                    {/* Badge */}
                    {product.badge && (
                      <div className="absolute top-4 right-4 px-2.5 py-1 bg-forcom-red/10 border border-forcom-red/30 rounded-sm">
                        <span className="font-display font-bold text-[10px] tracking-[0.15em] uppercase text-forcom-red">
                          {product.badge}
                        </span>
                      </div>
                    )}

                    {/* Product image */}
                    <div className="w-full aspect-[4/3] bg-gradient-to-br from-forcom-border/20 to-forcom-black/50 rounded-sm mb-5 flex items-center justify-center border border-forcom-border/30 overflow-hidden">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.model}
                          className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 opacity-40 group-hover:opacity-60 transition-opacity">
                          <svg className="w-10 h-10 text-forcom-gray" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                            <rect x="8" y="8" width="32" height="32" rx="2" stroke="currentColor" strokeWidth="1.5" />
                            <circle cx="18" cy="18" r="4" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M8 32l10-10 6 6 8-8 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="font-display text-[10px] tracking-[0.2em] uppercase text-forcom-gray">
                            Imagen del producto
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Category */}
                    <p className="font-display font-semibold text-[10px] tracking-[0.2em] uppercase text-forcom-red mb-1.5">
                      {product.category}
                    </p>

                    {/* Model name */}
                    <h4 className="font-display font-bold text-xl tracking-tight text-white mb-4">
                      {product.model}
                    </h4>

                    {/* Specs */}
                    <ul className="space-y-2 mb-5">
                      {product.specs.map((spec) => (
                        <li key={spec} className="flex items-start gap-2 text-sm text-forcom-gray leading-snug">
                          <span className="mt-1.5 w-1 h-1 bg-forcom-red rounded-full shrink-0" />
                          {spec}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <button
                      type="button"
                      onClick={() => setSelected(product)}
                      className="inline-flex items-center gap-2 font-display font-semibold text-xs tracking-[0.15em] uppercase text-forcom-gray hover:text-forcom-red transition-colors group/link"
                    >
                      Ver especificaciones
                      <svg className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <ProductSpecsModal product={selected} onClose={() => setSelected(null)} />
    </>
  );
}
