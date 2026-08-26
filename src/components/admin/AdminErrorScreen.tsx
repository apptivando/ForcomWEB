"use client";

import Link from "next/link";

/**
 * Pantalla de error compartida de todo el panel.
 *
 * Se renderiza DENTRO de `(panel)/layout.tsx`, así que el menú lateral sigue
 * ahí: un fallo en una sección no deja al operador varado sin navegación, que
 * era el problema del `error.tsx` global (ese reemplaza la ventana entera y
 * muestra solo un número de ocho dígitos).
 *
 * El `digest` no se esconde —es lo único que permite encontrar el error en los
 * logs del deploy— pero baja a texto secundario y se presenta como lo que es:
 * un código para pasarle a soporte, no un mensaje para el usuario.
 */
export default function AdminErrorScreen({
  section,
  error,
  reset,
  hint,
}: {
  /** Nombre de la sección tal como figura en el menú. */
  section: string;
  error: Error & { digest?: string };
  reset: () => void;
  /** Pista accionable propia de la sección (qué revisar antes de reintentar). */
  hint?: React.ReactNode;
}) {
  return (
    <div className="p-8 flex items-start justify-center min-h-[60vh]">
      <div className="max-w-lg w-full bg-[#141416] border border-[#2A2A2E] rounded-sm p-8 mt-12">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-1 self-stretch bg-[#E8231A] rounded-sm shrink-0" />
          <div>
            <p className="font-display font-extrabold text-xl text-white">
              {section} no se pudo cargar
            </p>
            <p className="text-[15px] text-[#B0B0B0] mt-1">
              El resto del panel sigue funcionando. Podés reintentar o irte a otra
              sección desde el menú.
            </p>
          </div>
        </div>

        {error.message && (
          <p className="text-[15px] text-[#8A8A8A] bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-4 py-3 mb-3 break-words">
            {error.message}
          </p>
        )}

        {hint && <div className="text-[13px] text-[#8A8A8A] mb-5">{hint}</div>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={reset}
            className="px-6 py-3 bg-[#C41D16] text-white font-display font-bold text-[15px] tracking-widest uppercase rounded-sm hover:bg-[#E8231A] transition-colors"
          >
            Reintentar
          </button>
          <Link
            href="/admin/dashboard"
            className="px-6 py-3 border border-[#2A2A2E] text-[#B0B0B0] hover:text-white hover:border-[#3A3A3E] font-display font-bold text-[15px] tracking-widest uppercase rounded-sm transition-colors"
          >
            Volver al panel
          </Link>
        </div>

        {error.digest && (
          <p className="text-[13px] text-[#6E6E76] mt-6 pt-4 border-t border-[#2A2A2E]">
            Código para soporte:{" "}
            <code className="text-[#8A8A8A]">{error.digest}</code>
          </p>
        )}
      </div>
    </div>
  );
}
