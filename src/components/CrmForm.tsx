"use client";

import { useEffect, useRef } from "react";

/** Script que da el CRM del cliente (crm.ventaweb.ar). El mismo en Latin Office. */
export const CRM_EMBED_SRC = "https://crm.ventaweb.ar/embed.js";

/**
 * Formulario de consultas del CRM del cliente.
 *
 * `embed.js` no se engancha con nuestros formularios: crea un iframe con el
 * formulario del CRM y lo inserta justo antes de su propia etiqueta <script>
 * (usa `document.currentScript`). Le pasa al CRM el dominio, la página, los
 * utm_* y el dominio de origen. Lo que se carga ahí va solo al CRM: no entra
 * a Mensajes del panel.
 *
 * Por eso no se pone como <script> suelto (React no lo ejecuta, y next/script
 * lo manda al final del <body>): se crea acá adentro del contenedor, que es
 * donde tiene que aparecer el iframe. Al volver a esta página sin recargar, se
 * vuelve a crear.
 *
 * Si el CRM se cae, el formulario propio se prende desde el panel (Info
 * empresa) — ver migración 024. Mismo componente que LatinOfficeWEB.
 */
export default function CrmForm() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const script = document.createElement("script");
    script.src = CRM_EMBED_SRC;
    script.async = true;
    el.appendChild(script);
    return () => {
      el.replaceChildren();
    };
  }, []);

  return <div className="crm-embed" ref={box} />;
}
