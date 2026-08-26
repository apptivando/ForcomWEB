"use client";

import AdminErrorScreen from "@/components/admin/AdminErrorScreen";

export default function PipelinesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AdminErrorScreen section="El pipeline de ventas" error={error} reset={reset} />
  );
}
