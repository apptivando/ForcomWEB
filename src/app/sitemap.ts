import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { parseCatalogUrl } from "@/lib/catalog";

const BASE_URL = "https://www.forcom.tech";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const [{ data: products }, { data: companyInfo }] = await Promise.all([
    supabase.from("products").select("slug, updated_at").eq("active", true),
    supabase.from("company_info").select("*").eq("id", 1).single(),
  ]);

  // /catalogo existe solo mientras haya un catálogo cargado en el panel.
  const catalogUrls: MetadataRoute.Sitemap = parseCatalogUrl(companyInfo?.catalog_url)
    ? [
        {
          url: `${BASE_URL}/catalogo`,
          lastModified: companyInfo?.updated_at ? new Date(companyInfo.updated_at) : new Date(),
          changeFrequency: "monthly",
          priority: 0.9,
        },
      ]
    : [];

  const productUrls: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
    url: `${BASE_URL}/productos/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...catalogUrls,
    ...productUrls,
  ];
}
