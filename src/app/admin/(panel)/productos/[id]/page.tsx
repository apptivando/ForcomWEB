import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductForm from "@/components/admin/ProductForm";

const SECTIONS = [
  { label: "Smart POS — Terminales Inteligentes", id: "cat-smart-pos" },
  { label: "Mini PC — Computación Compacta", id: "cat-mini-pc" },
  { label: "Impresoras — Térmica & Etiquetas", id: "cat-impresoras" },
  { label: "Lectores de Escritorio", id: "cat-lectores" },
  { label: "Lectores de Mano", id: "cat-lectores-mano" },
  { label: "Verificadores de Precio", id: "cat-verificadores" },
  { label: "Accesorios", id: "cat-accesorios" },
  { label: "Balanzas", id: "cat-balanzas" },
];

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "nuevo";

  let product = null;
  if (!isNew) {
    const supabase = await createClient();
    const { data } = await supabase.from("products").select("*").eq("id", id).single();
    if (!data) notFound();
    product = data;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-3xl text-white">
          {isNew ? "Agregar producto" : "Editar producto"}
        </h1>
        {!isNew && (
          <p className="text-[#8A8A8A] mt-1">{product?.model}</p>
        )}
      </div>
      <ProductForm product={product} sections={SECTIONS} />
    </div>
  );
}
