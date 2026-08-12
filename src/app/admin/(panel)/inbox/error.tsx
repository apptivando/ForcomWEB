"use client";

// Error boundary de esta ruta — si algo revienta (ej. Evolution caído,
// la instancia de WhatsApp desconectada), se ve un aviso acá adentro
// en vez de tirar toda la página con el error genérico de Next.
export default function InboxError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <p className="text-white font-display font-semibold mb-2">
          Algo falló en la bandeja
        </p>
        <p className="text-sm text-[#8A8A8A] mb-1">
          {error.message || "Error desconocido."}
        </p>
        <p className="text-xs text-[#8A8A8A] mb-6">
          Si estabas mandando un mensaje, revisá que la conexión de WhatsApp
          en Evolution siga activa antes de reintentar.
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
