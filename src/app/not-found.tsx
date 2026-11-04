import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata: Metadata = { title: "Página no encontrada · FORCOM" };

/**
 * Sin este archivo, una dirección que no existe (o un producto dado de baja)
 * mostraba el 404 de Next, en inglés y sin menú. Mismo criterio que
 * LatinOfficeWEB (`src/app/not-found.tsx`).
 */
export default function NotFound() {
  return (
    <>
      <Navbar solid />
      <main className="min-h-[70vh] flex items-center bg-forcom-black pt-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-24">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-[2px] bg-forcom-red" />
            <span className="font-display font-semibold text-xs tracking-[0.3em] uppercase text-forcom-red-text">Error 404</span>
          </div>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight text-white mb-6">
            No encontramos esta página
          </h1>
          <p className="text-forcom-gray-light text-lg leading-relaxed mb-10 max-w-md">
            Puede que la dirección esté mal escrita o que el producto ya no esté en el catálogo.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/"
              className="px-6 py-3 bg-forcom-red-dark text-white font-display font-bold text-sm tracking-[0.1em] uppercase rounded-sm hover:bg-forcom-red transition-colors"
            >
              Ir al inicio
            </Link>
            <Link
              href="/#productos"
              className="px-6 py-3 border border-forcom-border text-white font-display font-bold text-sm tracking-[0.1em] uppercase rounded-sm hover:border-forcom-red transition-colors"
            >
              Ver productos
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
