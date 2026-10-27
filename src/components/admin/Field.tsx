"use client";

/**
 * Campo de formulario con su etiqueta REALMENTE asociada al control.
 *
 * El panel tenía 37 `<label>` y ninguno asociado: eran divs y labels sueltos
 * al lado del input, o sea etiquetas visuales nada más. Con lector de pantalla
 * no se anunciaba de qué campo se trataba, y el globo de validación nativo
 * decía "Complete este campo" sin identificar cuál.
 *
 * La asociación se hace **envolviendo** el control en el `<label>`, no con
 * `htmlFor` + `id`. Es equivalente para el navegador y para el lector de
 * pantalla, y no obliga a inventar y mantener un id único por campo en cada
 * uno de los formularios.
 */
export const fieldLabelCls =
  "block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5";

export default function Field({
  label,
  hint,
  required,
  children,
  className = "",
}: {
  label: React.ReactNode;
  /** Explicación bajo el control. La microcopia del panel es su mejor virtud. */
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className={fieldLabelCls}>
        {label}
        {required && <span className="text-[#FF6A5C]"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-[13px] text-[#8A8A8A] mt-1.5">{hint}</span>}
    </label>
  );
}
