import type { OfflineAction, OfflineActionType } from '../types/offline';

/**
 * Handler que reproduce (replay) una accion offline al reconectar.
 * Recibe la accion completa y ejecuta el side effect contra el service correspondiente.
 */
export type OfflineHandler = (action: OfflineAction) => Promise<void>;

/**
 * Registry central de handlers por tipo de accion offline (#335).
 *
 * Reemplaza el switch gigante de `syncEngine.executeAction`. Cada handler se
 * registra una vez via {@link registerOfflineHandler}; `dispatch` (en syncEngine)
 * hace el lookup. La exhaustividad sobre `OfflineActionType` se garantiza en el
 * modulo de registro (`registerOfflineHandlers.ts`) via un `Record` tipado, y en
 * runtime via `assertNever` en `dispatch`.
 */
const registry = new Map<OfflineActionType, OfflineHandler>();

/** Registra (o sobreescribe) el handler para un tipo de accion offline. */
export function registerOfflineHandler(type: OfflineActionType, handler: OfflineHandler): void {
  registry.set(type, handler);
}

/** Devuelve el handler registrado para un tipo, o `undefined` si no hay. */
export function getOfflineHandler(type: OfflineActionType): OfflineHandler | undefined {
  return registry.get(type);
}

/** `true` si el tipo tiene handler registrado. */
export function hasOfflineHandler(type: OfflineActionType): boolean {
  return registry.has(type);
}

/** Test-only: limpia el registry entre tests. No usar en produccion. */
export function __resetOfflineHandlersForTests(): void {
  registry.clear();
}
