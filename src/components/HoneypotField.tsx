/**
 * Campo trampa (ver lib/antispam). No se ve, no se tabula y no lo lee un
 * lector de pantalla; un bot que completa todo lo que encuentra en el DOM sí
 * lo llena. `left-[-9999px]` en vez de `display:none` porque algunos bots
 * saltean lo que está oculto por CSS. Los `data-*` frenan a los gestores de
 * contraseñas, que si lo autocompletaran descartarían a una persona real.
 */
export default function HoneypotField({ name, id }: { name: string; id: string }) {
  return (
    <div className="absolute left-[-9999px] top-auto w-px h-px overflow-hidden" aria-hidden="true">
      <label htmlFor={id}>No completar este campo</label>
      <input
        id={id}
        name={name}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        data-1p-ignore="true"
        data-lpignore="true"
        data-form-type="other"
        defaultValue=""
      />
    </div>
  );
}
