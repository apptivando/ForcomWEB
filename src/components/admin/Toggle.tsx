"use client";

/**
 * Interruptor de encendido/apagado del panel.
 *
 * Existe para que "activo" signifique lo mismo en todas las secciones. Estaba
 * copiado y pegado en cinco lugares (Hero, slides, ficha de producto, agente,
 * automatizaciones) y ya había empezado a divergir en tamaño y en color.
 *
 * **Encendido va en verde, no en rojo.** Rojo para "encendido" es
 * contraintuitivo: en casi cualquier interfaz el rojo señala peligro o
 * apagado. Acá el rojo queda reservado para lo destructivo, que es la otra
 * mitad del mismo problema — cuando todo es rojo, el rojo no avisa nada.
 *
 * El `role="switch"` con `aria-checked` es lo que hace que un lector de
 * pantalla lo anuncie como interruptor y diga en qué estado está; un `<button>`
 * pelado se anuncia como botón y no dice nada del estado.
 */
export default function Toggle({
  checked,
  onChange,
  label,
  disabled,
  size = "md",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Se anuncia al lector de pantalla. Si hay texto al lado, repetirlo acá. */
  label: string;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const track = size === "sm" ? "w-10 h-5" : "w-11 h-6";
  const knob = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const shift = size === "sm" ? "translate-x-5" : "translate-x-5";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 ${track} rounded-full transition-colors disabled:opacity-50
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A5C]
                  ${checked ? "bg-green-600" : "bg-[#2A2A2E]"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 ${knob} bg-white rounded-full transition-transform
                    ${checked ? shift : "translate-x-0"}`}
      />
    </button>
  );
}
