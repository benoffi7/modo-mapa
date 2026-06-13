/**
 * Exhaustiveness helper para uniones discriminadas.
 *
 * Llamar `assertNever(x)` en el `default`/fallback de un switch o lookup sobre
 * una union: TypeScript falla en compilacion si queda algun caso sin manejar
 * (el parametro deja de ser `never`). En runtime lanza, atrapando datos
 * corruptos o tipos persistidos por una version vieja del cliente.
 *
 * @param value El valor que deberia ser `never` (todos los casos cubiertos).
 * @param context Etiqueta opcional para el mensaje de error.
 */
export function assertNever(value: never, context = 'value'): never {
  throw new Error(`Unhandled ${context}: ${String(value)}`);
}
