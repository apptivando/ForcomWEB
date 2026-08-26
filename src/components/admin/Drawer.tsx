"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Panel lateral que se desliza desde la derecha, con la lista de atrás
 * **visible y usable**.
 *
 * ─── Por qué no es un modal ───────────────────────────────────────────────
 * `<dialog showModal()>` regalaría Escape, focus trap y top layer nativos, y
 * es lo primero que uno quiere usar. Pero **inertiza el fondo**: la lista
 * quedaría visible pero no clickeable, y saltar de un cliente a otro haciendo
 * click en otra fila —que es el punto de que sea un panel y no un modal—
 * dejaría de funcionar. Attio, Linear y Odoo hacen lo mismo que esto.
 *
 * Por la misma razón **no hay click-fuera para cerrar** en escritorio: cada
 * click en una fila sería a la vez "abrir esta ficha" y "cerrar el panel". Se
 * cierra con Escape, con la X, o con el botón "atrás" del navegador. En
 * pantallas chicas el panel va a ancho completo, la lista queda tapada, y ahí
 * sí hay velo que cierra al tocarlo: no hay ambigüedad porque no hay fila
 * visible detrás.
 *
 * ─── Detalles que costaron ────────────────────────────────────────────────
 * - **Sin `createPortal`**: ningún ancestro del panel de admin tiene
 *   `transform`, `filter` ni `contain`, y `overflow: auto` no crea bloque
 *   contenedor para `position: fixed`. La única regla es no renderizarlo
 *   dentro de un `<tbody>`, que rompe la hidratación.
 * - **Nada de bloquear el scroll del body**: en este panel el `body` no
 *   scrollea (scrollean `main` y el contenedor de la página), así que la
 *   receta habitual es un no-op. Y en escritorio tampoco se quiere: el sentido
 *   del panel es que la lista siga usable. Va `overscroll-contain` para que la
 *   rueda del mouse no encadene al fondo al llegar al final.
 * - **`aria-modal="false"`** y sin focus trap: atrapar el foco sin declararse
 *   modal le miente al lector de pantalla.
 * - **`z-40`, no `z-50`**: ese queda para lo verdaderamente modal.
 */

type Phase = "closed" | "entering" | "open" | "leaving";

const EXIT_MS = 200;

export default function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>(open ? "entering" : "closed");
  const [wasOpen, setWasOpen] = useState(open);
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Ajuste durante el render y no en un efecto: es el patrón que recomienda
  // React para reaccionar a un cambio de prop, y evita el commit desperdiciado
  // que provoca llamar a setState sincrónicamente dentro de un efecto.
  if (open !== wasOpen) {
    setWasOpen(open);
    setPhase(open ? "entering" : "leaving");
  }

  // Entrada y salida en dos tiempos cada una. La salida es la que obliga a
  // tener una máquina de estados: cuando el padre deja de renderizar el panel,
  // React lo desmonta y no queda nada que animar, así que el desmontaje se
  // retrasa hasta que la transición termina.
  useEffect(() => {
    if (phase === "entering") {
      // Se anota a dónde devolver el foco al cerrar. Va acá y no durante el
      // render porque tocar un ref mientras se renderiza no está permitido; el
      // efecto corre antes de que el panel se lleve el foco, así que
      // `activeElement` todavía es quien abrió la ficha.
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      // El rAF no es decorativo: sin él el navegador colapsa los dos estilos en
      // el mismo frame y no hay transición, solo un salto.
      const raf = requestAnimationFrame(() => setPhase("open"));
      return () => cancelAnimationFrame(raf);
    }
    if (phase === "leaving") {
      const timer = setTimeout(() => {
        setPhase("closed");
        returnFocusRef.current?.focus?.();
      }, EXIT_MS);
      return () => clearTimeout(timer);
    }
    if (phase === "open") panelRef.current?.focus();
  }, [phase]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Si había un desplegable abierto o un input en composición, el navegador
      // ya consumió el Escape para eso. Sin este guard, cancelar un `<select>`
      // cerraría la ficha entera.
      if (e.defaultPrevented) return;
      e.preventDefault();
      onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    // En `document` y no en el panel: el foco puede estar en cualquier lado.
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, handleKey]);

  if (phase === "closed") return null;

  const shown = phase === "open";

  return (
    <>
      {/* Velo solo en pantallas chicas, donde el panel tapa la lista entera. */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/60 lg:hidden transition-opacity duration-200 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={typeof title === "string" ? title : "Ficha"}
        tabIndex={-1}
        className={`fixed inset-y-0 right-0 z-40 w-full lg:w-[560px]
                    bg-[#141416] border-l border-[#2A2A2E] flex flex-col
                    shadow-[0_0_40px_rgba(0,0,0,0.5)] outline-none
                    transition-transform duration-200 ease-out
                    motion-reduce:transition-none
                    ${shown ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-[#2A2A2E] shrink-0">
          <div className="min-w-0">
            <div className="font-display font-semibold text-white truncate">{title}</div>
            {subtitle && <div className="text-[13px] text-[#8A8A8A] mt-0.5 truncate">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            className="text-[#8A8A8A] hover:text-white transition-colors shrink-0 p-1 -m-1"
            title="Cerrar (Esc)"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>
      </aside>
    </>
  );
}
