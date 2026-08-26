"use client";

import AdminErrorScreen from "@/components/admin/AdminErrorScreen";

// Acá el tercero que se cae es Evolution (la instancia de WhatsApp
// desconectada), no Supabase — por eso la pista apunta ahí.
export default function InboxError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AdminErrorScreen
      section="La bandeja de WhatsApp"
      error={error}
      reset={reset}
      hint="Si estabas mandando un mensaje, revisá que la conexión de WhatsApp en Evolution siga activa antes de reintentar."
    />
  );
}
