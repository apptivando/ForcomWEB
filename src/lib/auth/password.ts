/**
 * Regla de contraseñas, en un solo lugar: la valida el formulario (para avisar
 * mientras se escribe) y la vuelve a validar la server action (porque el
 * chequeo del navegador se puede saltear).
 *
 * Sin dependencias de servidor — este módulo lo importa también el cliente.
 */

export const MIN_PASSWORD_LENGTH = 8;

/** Devuelve el error a mostrar, o null si la contraseña sirve. */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (/^\s|\s$/.test(password)) {
    return "La contraseña no puede empezar ni terminar con un espacio.";
  }
  return null;
}
