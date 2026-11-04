import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import HeroCarousel from "@/components/HeroCarousel";
import ProductCards from "@/components/ProductCards";
import WhyForcom from "@/components/WhyForcom";
import Industries from "@/components/Industries";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import ScrollReveal from "@/components/ScrollReveal";
import WhatsAppFAB from "@/components/WhatsAppFAB";
import FactsStrip from "@/components/FactsStrip";
import Resellers from "@/components/Resellers";
import Warranty from "@/components/Warranty";
import { parseCatalogUrl } from "@/lib/catalog";
import type { Fact, Product } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();

  const [{ data: heroSlides }, { data: products }, { data: companyInfo }, { data: facts }] = await Promise.all([
    supabase.from("hero_slides").select("*").eq("active", true).order("order_index"),
    supabase.from("products").select("*").eq("active", true).order("order_index"),
    supabase.from("company_info").select("*").eq("id", 1).single(),
    // Sin la migración 024 la tabla no existe: data llega null y la franja no se muestra.
    supabase.from("facts").select("title, text").order("order_index"),
  ]);

  // Todos los productos activos tienen garantía (decidido el 04/11/2026).
  const warrantyModels = ((products ?? []) as Product[]).map((p) => ({ id: p.id, model: p.model, section: p.section }));

  const productListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Catálogo de productos FORCOM",
    description: "Hardware POS y tecnología retail para comercios en Argentina",
    itemListElement: (products ?? []).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: p.model,
        category: p.category,
        description: p.description ?? undefined,
        image: p.image_url ?? undefined,
        // Cada producto del JSON-LD apunta a su ficha: es lo que permite que
        // Google muestre el resultado enriquecido con su propia URL.
        url: `https://www.forcom.tech/productos/${p.slug}`,
        brand: { "@type": "Brand", name: "FORCOM" },
        offers: {
          "@type": "Offer",
          availability: "https://schema.org/InStock",
          priceCurrency: "ARS",
          seller: { "@type": "Organization", name: "FORCOM" },
        },
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productListJsonLd) }}
      />
      <ScrollReveal />
      <Navbar showCatalog={!!parseCatalogUrl(companyInfo?.catalog_url)} />
      <main>
        <HeroCarousel slides={heroSlides} />
        <FactsStrip facts={(facts ?? []) as Pick<Fact, "title" | "text">[]} />
        <ProductCards products={products} />
        <WhyForcom />
        <Industries />
        <Resellers />
        <Warranty models={warrantyModels} />
        <Contact info={companyInfo ?? undefined} />
      </main>
      <Footer />
      <WhatsAppFAB number={companyInfo?.whatsapp} />
    </>
  );
}
