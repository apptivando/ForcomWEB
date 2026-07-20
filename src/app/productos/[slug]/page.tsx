import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppFAB, { DEFAULT_WHATSAPP_NUMBER } from "@/components/WhatsAppFAB";
import ProductDetails from "@/components/ProductDetails";
import ProductGallery from "@/components/ProductGallery";
import type { Product } from "@/lib/types";

const BASE_URL = "https://www.forcom.tech";

async function getProduct(slug: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .single();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};

  const title = `${product.model} — ${product.category} | FORCOM`;
  const description =
    product.description ??
    `${product.model}: hardware POS de grado empresarial distribuido por FORCOM en Argentina. Solicite su cotización.`;
  const image = (product.images ?? []).filter(Boolean)[0] ?? product.image_url ?? "/images/brand/forcom-logo.png";
  const url = `${BASE_URL}/productos/${product.slug}`;

  return {
    title,
    description,
    alternates: { canonical: `/productos/${product.slug}` },
    openGraph: {
      type: "website",
      locale: "es_AR",
      url,
      siteName: "FORCOM",
      title,
      description,
      images: [{ url: image, width: 1200, height: 900, alt: product.model }],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const supabase = await createClient();
  const [{ data: companyInfo }, { data: related }] = await Promise.all([
    supabase.from("company_info").select("*").eq("id", 1).single(),
    supabase
      .from("products")
      .select("*")
      .eq("section_id", product.section_id)
      .eq("active", true)
      .neq("id", product.id)
      .order("order_index")
      .limit(4),
  ]);

  const galleryImages = (product.images ?? []).filter(Boolean);
  const allImages = galleryImages.length > 0 ? galleryImages : product.image_url ? [product.image_url] : [];

  const whatsappNumber = companyInfo?.whatsapp || DEFAULT_WHATSAPP_NUMBER;
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `Hola, me interesa el ${product.model}. ¿Podrían enviarme más información?`
  )}`;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.model,
    category: product.category,
    description: product.description ?? undefined,
    image: (product.images ?? []).filter(Boolean).length > 0 ? product.images : product.image_url ?? undefined,
    url: `${BASE_URL}/productos/${product.slug}`,
    brand: { "@type": "Brand", name: "FORCOM" },
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      priceCurrency: "ARS",
      seller: { "@type": "Organization", name: "FORCOM" },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <Navbar />
      <main className="bg-forcom-dark min-h-screen">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-28 pb-20 lg:pt-32">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-2 text-xs text-forcom-gray">
            <Link href="/" className="hover:text-white transition-colors">Inicio</Link>
            <span>/</span>
            <Link href={`/#${product.section_id}`} className="hover:text-white transition-colors">
              {product.section}
            </Link>
            <span>/</span>
            <span className="text-white">{product.model}</span>
          </nav>

          {/* Top: gallery + título/specs/CTA */}
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
            <ProductGallery images={allImages} alt={product.model} />

            <div>
              <p className="font-display font-semibold text-xs tracking-[0.2em] uppercase text-forcom-red mb-2">
                {product.category}
              </p>
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight text-white mb-6">
                {product.model}
              </h1>

              {product.specs.length > 0 && (
                <ul className="space-y-2 mb-8">
                  {product.specs.map((spec) => (
                    <li key={spec} className="flex items-start gap-2 text-sm text-forcom-gray-light leading-snug">
                      <span className="mt-1.5 w-1 h-1 bg-forcom-red rounded-full shrink-0" />
                      {spec}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-6 py-3.5 bg-forcom-red text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-forcom-red-dark transition-colors"
                >
                  Consultar por WhatsApp
                </a>
                <Link
                  href="/#contacto"
                  className="inline-flex items-center justify-center px-6 py-3.5 border border-forcom-border text-white font-display font-semibold text-sm tracking-widest uppercase rounded-sm hover:border-forcom-red hover:text-forcom-red transition-colors"
                >
                  Solicitar cotización
                </Link>
              </div>
            </div>
          </div>

          {/* Debajo: descripción, specs técnicas, videos y documentos — una sola columna */}
          <div className="mt-16 lg:mt-20 max-w-3xl">
            <ProductDetails product={product} />
          </div>

          {/* Related products */}
          {related && related.length > 0 && (
            <div className="mt-24 pt-16 border-t border-forcom-border">
              <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-white mb-10">
                Productos relacionados
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {related.map((p: Product) => (
                  <Link
                    key={p.id}
                    href={`/productos/${p.slug}`}
                    className="bg-forcom-card border border-forcom-border rounded-sm p-5 hover:border-forcom-red/40 transition-colors group"
                  >
                    <div className="w-full aspect-[4/3] bg-forcom-black/50 rounded-sm mb-4 flex items-center justify-center border border-forcom-border/30 overflow-hidden">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.model}
                          className="w-full h-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span className="font-display text-[10px] tracking-[0.2em] uppercase text-forcom-gray">
                          FORCOM
                        </span>
                      )}
                    </div>
                    <p className="font-display font-semibold text-[10px] tracking-[0.2em] uppercase text-forcom-red mb-1">
                      {p.category}
                    </p>
                    <h3 className="font-display font-bold text-base text-white">{p.model}</h3>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
      <WhatsAppFAB number={companyInfo?.whatsapp} />
    </>
  );
}
