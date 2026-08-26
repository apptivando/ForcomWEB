"use client";

import AdminErrorScreen from "@/components/admin/AdminErrorScreen";

// Acá hay dos terceros que se pueden caer (Google Places y la API de búsqueda)
// además de Supabase, así que la pista cambia según qué haya fallado.
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
    <AdminErrorScreen
      section="Clientes"
      error={error}
      reset={reset}
      hint={
        missingTable
          ? "Parece que falta correr la migración 010_clientes_unificados.sql en Supabase (Dashboard > SQL Editor)."
          : "Si estabas buscando prospectos, revisá que GOOGLE_PLACES_API_KEY esté cargada antes de reintentar."
      }
    />
  );
}
