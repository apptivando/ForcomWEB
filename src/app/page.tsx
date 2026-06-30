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

export default async function Home() {
  const supabase = await createClient();

  const [{ data: heroSlides }, { data: products }, { data: companyInfo }] = await Promise.all([
    supabase.from("hero_slides").select("*").eq("active", true).order("order_index"),
    supabase.from("products").select("*").eq("active", true).order("order_index"),
    supabase.from("company_info").select("*").eq("id", 1).single(),
  ]);

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
      <Navbar />
      <main>
        <HeroCarousel slides={heroSlides} />
        <ProductCards products={products} />
        <WhyForcom />
        <Industries />
        <Contact info={companyInfo ?? undefined} />
      </main>
      <Footer />
      <WhatsAppFAB number={companyInfo?.whatsapp} />
    </>
  );
}
