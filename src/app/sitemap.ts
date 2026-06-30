import { MetadataRoute } from "next";

const BASE_URL = "https://www.forcom.tech";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // When product pages exist (post-MVP), agregar aquí:
  // const supabase = await createClient()
  // const { data: products } = await supabase
  //   .from('products').select('id, model').eq('active', true)
  // const productUrls = (products ?? []).map(p => ({
  //   url: `${BASE_URL}/productos/${p.id}`,
  //   lastModified: new Date(),
  //   changeFrequency: 'monthly' as const,
  //   priority: 0.8,
  // }))

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
