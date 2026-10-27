"use client";

import { usePathname } from "next/navigation";
import AdminErrorScreen from "@/components/admin/AdminErrorScreen";
import { sectionLabel } from "@/lib/admin/sections";

/**
 * Red de seguridad de todo el panel.
 *
 * Vive dentro de `(panel)/layout.tsx`, así que conserva el menú lateral. Cubre
 * las secciones que no tienen su propio `error.tsx`; las que sí lo tienen
 * (Clientes, Bandeja, Asistente, Pipeline, Automatizaciones) lo usan para
 * agregar una pista específica, no para reemplazar esta pantalla.
 *
 * Sin esto, cualquier fallo caía en `src/app/error.tsx`, que reemplaza la
 * ventana entera —menú incluido— y deja al operador sin forma de volver.
 */
export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AdminErrorScreen
      section={sectionLabel(usePathname())}
      error={error}
      reset={reset}
    />
  );
}
