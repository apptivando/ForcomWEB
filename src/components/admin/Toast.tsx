"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Avisos de "esto pasó" en la esquina, con opción de deshacer.
 *
 * El panel tenía la mitad buena del patrón —el botón dice "GUARDANDO…"— y le
 * faltaba la otra: crear un producto redirigía a la lista sin decir nada y el
 * usuario deducía el éxito viendo el registro; borrar tampoco avisaba ni
 * ofrecía vuelta atrás.
 *
 * El "Deshacer" no es adorno: en los borrados es la única red de seguridad que
 * existe hoy. Se implementa **posponiendo la acción**, no revirtiéndola —el
 * borrado recién se manda al servidor cuando el toast se va sin que nadie
 * toque Deshacer. Así no hace falta un "restore" en la base para cada tabla.
 */

export type ToastKind = "ok" | "error" | "info";

export interface ToastAction {
  label: string;
  onAction: () => void;
}

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Detalle chico bajo el mensaje: "Ver en el sitio", el nombre del registro… */
  detail?: string;
  action?: ToastAction;
  durationMs: number;
}

interface ToastApi {
  /** Aviso simple. Devuelve el id por si hay que cerrarlo a mano. */
  show: (message: string, opts?: Partial<Omit<Toast, "id" | "message">>) => number;
  /**
   * Acción destructiva con ventana de arrepentimiento. `commit` corre al
   * expirar el toast; si el usuario toca Deshacer, no corre nunca.
   */
  undoable: (message: string, commit: () => void | Promise<void>, opts?: { detail?: string; durationMs?: number }) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Se usa desde cualquier componente cliente del panel. Si el provider no está
 * montado no rompe: cae a un no-op, porque un aviso que falta nunca puede ser
 * la causa de que una pantalla no cargue.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return ctx ?? FALLBACK;
}

const FALLBACK: ToastApi = {
  show: () => -1,
  undoable: (_message, commit) => void commit(),
  dismiss: () => {},
};

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Lo que va a correr cuando el toast expire, por id. Vive fuera del estado
  // de React porque no se renderiza y no debe disparar re-render.
  const [pending] = useState(() => new Map<number, () => void | Promise<void>>());

  const dismiss = useCallback(
    (id: number) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      // Salir por expiración o por la X confirma la acción: solo "Deshacer" la
      // cancela, y ese camino borra la entrada antes de llamar acá.
      const commit = pending.get(id);
      if (commit) {
        pending.delete(id);
        void commit();
      }
    },
    [pending]
  );

  const api = useMemo<ToastApi>(
    () => ({
      show(message, opts) {
        const id = nextId++;
        setToasts((prev) => [
          ...prev,
          {
            id,
            kind: opts?.kind ?? "ok",
            message,
            detail: opts?.detail,
            action: opts?.action,
            durationMs: opts?.durationMs ?? 4000,
          },
        ]);
        return id;
      },
      undoable(message, commit, opts) {
        const id = nextId++;
        pending.set(id, commit);
        setToasts((prev) => [
          ...prev,
          {
            id,
            kind: "info",
            message,
            detail: opts?.detail,
            durationMs: opts?.durationMs ?? 7000,
            action: {
              label: "Deshacer",
              onAction() {
                // Cancelar antes de sacar el toast: si no, `dismiss` lo commitea.
                pending.delete(id);
                setToasts((p) => p.filter((t) => t.id !== id));
              },
            },
          },
        ]);
      },
      dismiss,
    }),
    [dismiss, pending]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        // `aria-live` para que el lector de pantalla lo anuncie sin robar foco.
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 w-[min(24rem,calc(100vw-3rem))] pointer-events-none"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const KIND_STYLE: Record<ToastKind, string> = {
  ok: "border-l-green-500",
  error: "border-l-[#E8231A]",
  info: "border-l-[#8A8A8A]",
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  return (
    <div
      className={`pointer-events-auto bg-[#1A1A1E] border border-[#2A2A2E] border-l-[3px] ${KIND_STYLE[toast.kind]} rounded-sm shadow-[0_4px_20px_rgba(0,0,0,0.5)] px-4 py-3 flex items-start gap-3`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[15px] text-white">{toast.message}</p>
        {toast.detail && <p className="text-[13px] text-[#8A8A8A] mt-0.5">{toast.detail}</p>}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={() => toast.action?.onAction()}
          className="shrink-0 text-xs font-display font-bold tracking-wider uppercase text-[#FF6A5C] hover:text-white transition-colors"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar aviso"
        className="shrink-0 text-[#6E6E76] hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
