"use client";

import { useCallback, useEffect, useId, useRef } from "react";

/**
 * Diálogo modal del panel. El hermano de `Drawer.tsx`, para el caso opuesto:
 * cuando el fondo **no** tiene que seguir usable.
 *
 * Existe porque los overlays del panel estaban hechos a mano y a ninguno le
 * llegaba lo que un modal necesita: Escape no cerraba, no había `role="dialog"`
 * ni `aria-modal`, y el `body` seguía con `overflow: visible`, así que la
 * página de atrás scrolleaba mientras uno creía estar scrolleando el modal.
 * El drawer de producto del sitio público sí lo tenía resuelto; la pieza
 * equivalente del panel, no.
 *
 * Lo que trae resuelto, que es exactamente lo que faltaba:
 *
 * - **Escape cierra**, con el mismo guard que `Drawer`: si un `<select>` ya
 *   consumió la tecla (`defaultPrevented`), no se cierra el diálogo entero.
 * - **`role="dialog"` + `aria-modal="true"`** y título asociado por
 *   `aria-labelledby`, así el lector de pantalla anuncia de qué es el diálogo.
 * - **Trampa de foco**: Tab y Shift+Tab circulan adentro. Acá sí corresponde
 *   —a diferencia de `Drawer`, que declara `aria-modal="false"` justamente
 *   para no atrapar el foco mintiendo.
 * - **Bloqueo del scroll de fondo**: en `body`, que es lo que scrollea (el
 *   `main` declara `overflow-auto` pero nunca llega a scrollear).
 * - **Retorno del foco** a quien abrió el diálogo, al cerrar.
 *
 * No usa `createPortal` por la misma razón que `Drawer`: ningún ancestro del
 * panel crea bloque contenedor para `position: fixed`.
 */

/** Todo lo que puede recibir foco con Tab dentro del diálogo. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  /** Ancho máximo del panel. Por defecto alcanza para un formulario. */
  width = "max-w-2xl",
  /** Clic en el velo cierra. Se apaga en formularios largos, donde un clic
   *  al costado no puede tirar media hora de trabajo. */
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  closeOnBackdrop?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Un desplegable abierto ya consumió el Escape para cerrarse a sí
        // mismo. Sin este guard, cancelar un <select> cerraría el diálogo.
        if (e.defaultPrevented) return;
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;

    // El scroll de fondo se bloquea en `body`: es lo que efectivamente
    // scrollea en este panel.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", handleKey);

    // Al abrir, el foco va al primer control del diálogo; si no hay ninguno,
    // al panel, para que Escape funcione igual.
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? panel)?.focus();

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${width} max-h-[90vh] flex flex-col outline-none
                    bg-[#141416] border border-[#2A2A2E] rounded-sm
                    shadow-[0_0_40px_rgba(0,0,0,0.6)]`}
      >
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-[#2A2A2E] shrink-0">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display font-bold text-lg text-white truncate">
              {title}
            </h2>
            {subtitle && <p className="text-[13px] text-[#8A8A8A] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar (Esc)"
            aria-label="Cerrar"
            className="text-[#8A8A8A] hover:text-white transition-colors shrink-0 p-1 -m-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-[#2A2A2E] shrink-0">{footer}</div>
        )}
      </div>
    </div>
  );
}
