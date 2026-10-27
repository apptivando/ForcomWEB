"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Avisa antes de perder lo que se escribió en un formulario.
 *
 * El problema que resuelve: la ficha de producto mide ~2700 px —cinco
 * imágenes, dos videos, un párrafo, la tabla de specs completa— y cargarla
 * desde el catálogo es media hora de trabajo. El menú lateral está siempre
 * visible al costado, así que un clic para "consultar otra cosa un segundo"
 * navegaba de inmediato y se llevaba todo, sin diálogo y sin aviso.
 *
 * Cómo funciona, y por qué así:
 *
 * - **Cierre de pestaña / recarga**: `beforeunload`, que es lo único que el
 *   navegador ofrece para eso.
 * - **Navegación interna**: el App Router de Next no expone un bloqueo de
 *   navegación oficial (no hay equivalente de `useBlocker`). El camino estable
 *   es interceptar el clic en el `<a>` interno *antes* de que el router lo
 *   tome —fase de captura, en `document`— en vez de pelearse con el router.
 *   Si el usuario confirma, el clic sigue su curso normal.
 *
 * El diálogo es el nativo (`confirm`) a propósito: es modal de verdad, no
 * depende de que el resto del panel esté montado y no se puede perder detrás
 * de un overlay. Cuando exista el componente de diálogo compartido del panel
 * se puede cambiar sin tocar a quien usa el hook.
 */
export function useUnsavedChanges(
  dirty: boolean,
  message = "Tenés cambios sin guardar. Si salís ahora se pierden."
) {
  useEffect(() => {
    if (!dirty) return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Chrome ignora el texto y muestra el suyo, pero `returnValue` sigue
      // siendo lo que dispara el diálogo.
      e.returnValue = message;
    }

    function onClick(e: MouseEvent) {
      // Clic con modificador, botón del medio o secundario: el navegador abre
      // en otra pestaña y esta página no se pierde. No hay nada que bloquear.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Mismo destino: no se pierde nada.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      // Que siga el router: el clic no se cancela.
      if (window.confirm(`${message}\n\n¿Salir igual?`)) return;

      e.preventDefault();
      e.stopPropagation();
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    // Captura: hay que llegar antes que el handler del <Link> de Next.
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);
}

/**
 * Azúcar sobre `useUnsavedChanges` para el caso habitual: un objeto de estado
 * de formulario. Guarda el valor inicial al montar y compara serializado —el
 * formulario es plano y chico, no hace falta más—; `markSaved()` mueve la
 * referencia después de guardar, para que navegar a la lista no pregunte nada.
 *
 * El snapshot va en `useState` y no en un ref porque `dirty` sí se usa en el
 * render (habilita botones, muestra avisos).
 */
export function useFormGuard<T>(form: T, message?: string) {
  const current = JSON.stringify(form);
  const [baseline, setBaseline] = useState(current);
  const dirty = current !== baseline;

  useUnsavedChanges(dirty, message);

  /** Llamar después de un guardado exitoso, antes de navegar. */
  const markSaved = useCallback(
    (saved?: T) => setBaseline(saved === undefined ? JSON.stringify(form) : JSON.stringify(saved)),
    [form]
  );

  return { dirty, markSaved };
}
