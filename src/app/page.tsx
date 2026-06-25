import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import HeroCarousel from "@/components/HeroCarousel";
import ProductCards from "@/components/ProductCards";
import WhyForcom from "@/components/WhyForcom";
import Industries from "@/components/Industries";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import ScrollReveal from "@/components/ScrollReveal";

export default async function Home() {
  const supabase = await createClient();

  const [{ data: heroSlides }, { data: products }] = await Promise.all([
    supabase.from("hero_slides").select("*").eq("active", true).order("order_index"),
    supabase.from("products").select("*").eq("active", true).order("order_index"),
  ]);

  return (
    <>
      <ScrollReveal />
      <Navbar />
      <main>
        <HeroCarousel slides={heroSlides} />
        <ProductCards products={products} />
        <WhyForcom />
        <Industries />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
