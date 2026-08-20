"use client";

// Error boundary de esta ruta. Acá hay dos terceros que se pueden caer (Google
// Places y la API de búsqueda) además de Supabase, así que conviene que el
// error quede contenido en la página en vez de tirar todo el panel.
export default function ClientesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const missingTable = /crm_contacts|prospect_searches|contact_tier|column .* does not exist/i.test(
    error.message
  );

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <p className="text-white font-display font-semibold mb-2">Algo falló en Clientes</p>
        <p className="text-sm text-[#8A8A8A] mb-1">{error.message || "Error desconocido."}</p>
        <p className="text-xs text-[#8A8A8A] mb-6">
          {missingTable
            ? "Parece que falta correr la migración 010_clientes_unificados.sql en Supabase (Dashboard > SQL Editor)."
            : "Si estabas buscando prospectos, revisá que GOOGLE_PLACES_API_KEY esté cargada antes de reintentar."}
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
