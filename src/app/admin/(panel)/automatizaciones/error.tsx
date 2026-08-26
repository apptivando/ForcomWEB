"use client";

import AdminErrorScreen from "@/components/admin/AdminErrorScreen";

export default function AutomatizacionesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AdminErrorScreen section="Automatizaciones" error={error} reset={reset} />
  );
}
