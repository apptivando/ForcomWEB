"use client";

import Link from "next/link";

/**
 * Último recurso de toda la app (sitio público incluido).
 *
 * El panel tiene su propia pantalla en `(panel)/error.tsx`, que conserva el
 * menú; acá solo caen los fallos del sitio público o del layout raíz. Antes
 * mostraba únicamente el `digest`, un número de ocho dígitos sin contexto y
 * sin ningún enlace para volver.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D0D0F] text-white px-6 text-center">
      <h2 className="font-display font-extrabold text-3xl mb-2">Algo salió mal</h2>
      <p className="text-[#B0B0B0] text-sm max-w-md mb-8">
        No pudimos cargar esta página. Podés reintentar o volver al inicio.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="px-6 py-3 bg-[#E8231A] text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-[#C41D16] transition-colors"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="px-6 py-3 border border-[#2A2A2E] text-[#B0B0B0] hover:text-white hover:border-[#3A3A3E] font-display font-bold text-sm tracking-widest uppercase rounded-sm transition-colors"
        >
          Ir al inicio
        </Link>
      </div>
      {error.digest && (
        <p className="text-[11px] text-[#6E6E76] mt-8">
          Código para soporte: <code className="text-[#8A8A8A]">{error.digest}</code>
        </p>
      )}
    </div>
  );
}
