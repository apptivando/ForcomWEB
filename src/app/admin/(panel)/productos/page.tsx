import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProductsTable from "@/components/admin/ProductsTable";

export default async function ProductosPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("order_index", { ascending: true });

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display font-extrabold text-3xl text-white">Productos</h1>
          <p className="text-[#8A8A8A] mt-1">{products?.length ?? 0} productos en el catálogo</p>
        </div>
        <Link
          href="/admin/productos/nuevo"
          className="px-5 py-2.5 bg-[#E8231A] text-white font-display font-bold text-xs tracking-widest uppercase rounded-sm hover:bg-[#C41D16] transition-colors"
        >
          + Agregar producto
        </Link>
      </div>
      <ProductsTable products={products ?? []} />
    </div>
  );
}
