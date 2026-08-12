"use client";

export default function AgenteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md text-center">
        <p className="text-white font-display font-semibold mb-2">
          Algo falló en el asistente
        </p>
        <p className="text-sm text-[#8A8A8A] mb-6">
          {error.message || "Error desconocido."}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-[#E8231A] text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-[#C41D16] transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
