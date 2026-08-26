"use client";

import AdminErrorScreen from "@/components/admin/AdminErrorScreen";

export default function AgenteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AdminErrorScreen
      section="El asistente de IA"
      error={error}
      reset={reset}
      hint="Si estabas reindexando o probando el simulador, revisá que la clave del proveedor y la de embeddings sigan cargadas antes de reintentar."
    />
  );
}
