import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppFAB from "@/components/WhatsAppFAB";
import { parseCatalogUrl } from "@/lib/catalog";
import type { Product } from "@/lib/types";

const BASE_URL = "https://www.forcom.tech";
const TITLE = "Catálogo de productos | FORCOM";
const DESCRIPTION =
  "Catálogo FORCOM: terminales Smart POS, mini PC, impresoras térmicas y de etiquetas, lectores de código de barras, verificadores de precio, balanzas y accesorios. Hojealo online.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/catalogo" },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: `${BASE_URL}/catalogo`,
    siteName: "FORCOM",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/images/brand/forcom-logo.png", width: 1200, height: 630, alt: "FORCOM" }],
  },
};

/** Agrupa por sección respetando el orden del catálogo (order_index). */
function groupBySection(products: Product[]) {
  const groups = new Map<string, { section: string; sectionId: string; items: Product[] }>();
  for (const p of products) {
    const g = groups.get(p.section_id) ?? { section: p.section, sectionId: p.section_id, items: [] };
    g.items.push(p);
    groups.set(p.section_id, g);
  }
  return [...groups.values()];
}

export default async function CatalogoPage() {
  const supabase = await createClient();
  const [{ data: companyInfo }, { data: products }] = await Promise.all([
    supabase.from("company_info").select("*").eq("id", 1).single(),
    supabase.from("products").select("*").eq("active", true).order("order_index"),
  ]);

  const catalog = parseCatalogUrl(companyInfo?.catalog_url);
  if (!catalog) notFound();

  const sections = groupBySection((products ?? []) as Product[]);

  return (
    <>
      <Navbar showCatalog solid />
      <main className="bg-forcom-dark pt-16 lg:pt-20">
        {/* Visor. En pantallas medianas para arriba ocupa todo lo que queda
            debajo del menú (64 px, 80 px en lg) y de la barra de título
            (56 px), así el menú de FORCOM queda siempre a la vista. */}
        <section aria-labelledby="catalogo-titulo">
          <div className="border-b border-forcom-border bg-forcom-black">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 md:h-14 py-8 md:py-0 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1
                  id="catalogo-titulo"
                  className="font-display font-extrabold text-3xl md:text-xl tracking-tight text-white"
                >
                  Catálogo de productos
                </h1>
                <p className="md:hidden text-sm text-forcom-gray-light mt-2 leading-relaxed">
                  Todo el equipamiento FORCOM en un solo lugar. Hojealo en pantalla completa.
                </p>
              </div>
              <a
                href={catalog.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 md:px-0 md:py-0 bg-forcom-red-dark md:bg-transparent text-white md:text-forcom-red-text font-display font-bold text-sm tracking-[0.1em] uppercase rounded-sm hover:bg-forcom-red md:hover:bg-transparent md:hover:text-white transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Abrir en pantalla completa
              </a>
            </div>
          </div>

          {/* En celular no se embebe: el flipbook queda demasiado chico para
              leerse, así que se ofrece abrirlo entero (el botón de arriba). */}
          <iframe
            src={catalog.embedUrl}
            title="Catálogo de productos FORCOM"
            allow="clipboard-write; autoplay; fullscreen"
            allowFullScreen
            className="hidden md:block w-full md:h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-8.5rem)] bg-forcom-black"
          />
        </section>

        {/* Lo que está dentro del iframe no cuenta para Google como contenido
            de forcom.tech. Esta lista sí: nombra cada producto y enlaza a su
            ficha. */}
        {sections.length > 0 && (
          <section aria-labelledby="catalogo-productos" className="max-w-7xl mx-auto px-6 lg:px-8 py-16 lg:py-20">
            <p className="font-display font-semibold text-xs tracking-[0.2em] uppercase text-forcom-red-text mb-2">
              Qué hay en el catálogo
            </p>
            <h2
              id="catalogo-productos"
              className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-white mb-4"
            >
              Hardware POS fabricado por FORCOM
            </h2>
            <p className="text-forcom-gray-light leading-relaxed max-w-prose mb-12">
              Terminales, periféricos y accesorios para supermercados, restaurantes, farmacias,
              logística y comercios de todo tipo. Como fabricantes, adaptamos cada equipo a su
              operación, sostenemos los repuestos en el tiempo y damos garantía directa.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10">
              {sections.map((s) => (
                <div key={s.sectionId}>
                  <h3 className="font-display font-bold text-lg text-white tracking-wide mb-3 pb-2 border-b border-forcom-border">
                    {s.section}
                  </h3>
                  <ul className="space-y-2">
                    {s.items.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/productos/${p.slug}`}
                          className="group flex flex-col text-sm leading-snug"
                        >
                          <span className="text-forcom-gray-light group-hover:text-forcom-red-text transition-colors font-semibold">
                            {p.model}
                          </span>
                          <span className="text-xs text-forcom-gray">{p.category}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-14">
              <a
                href="/#contacto"
                className="inline-block px-6 py-3 bg-forcom-red-dark text-white font-display font-bold text-sm tracking-[0.1em] uppercase rounded-sm hover:bg-forcom-red transition-colors"
              >
                Pedí tu cotización
              </a>
            </div>
          </section>
        )}
      </main>
      <Footer />
      <WhatsAppFAB number={companyInfo?.whatsapp} />
    </>
  );
}
