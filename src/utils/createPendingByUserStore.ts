import { onAuthStateChanged } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { auth as defaultAuth } from '../config/firebase';

/**
 * Tipado de la API que expone cada store creado por {@link createPendingByUserStore}.
 *
 * `T` es la forma del snapshot acumulado por usuario (e.g. `Partial<UserSettings>`,
 * `string[]`, `Date`).
 */
export interface PendingByUserStore<T> {
  /** Reemplaza el snapshot pendiente del usuario. */
  set(uid: string, value: T): void;
  /** Devuelve el snapshot pendiente del usuario, o `undefined` si no hay. */
  get(uid: string): T | undefined;
  /** Elimina el snapshot pendiente del usuario. */
  delete(uid: string): void;
  /**
   * Lee y elimina el snapshot pendiente del usuario en una sola operacion.
   * Equivalente a `const v = get(uid); delete(uid); return v;` — patron tipico
   * del flush al reconectar (toma el snapshot y lo consume).
   */
  take(uid: string): T | undefined;
  /** `true` si hay un snapshot pendiente para el usuario. */
  has(uid: string): boolean;
  /**
   * Test-only: limpia todo el estado modular (map + uid previo) y desuscribe
   * el listener de auth. No usar en codigo de produccion.
   */
  __reset(): void;
}

/**
 * Factory que crea un store `Map<uid, T>` a nivel modulo con UN unico listener
 * `onAuthStateChanged` que limpia el snapshot del UID anterior en logout / switch
 * de cuenta.
 *
 * Reemplaza el boilerplate triplicado de #323 (`useUserSettings`, `useFollowedTags`,
 * `useInterestsFeed`) donde cada hook declaraba su propio `Map`, su propio
 * `_previousUid` y su propio `onAuthStateChanged`.
 *
 * Por que a nivel modulo: el snapshot debe sobrevivir al unmount del consumer
 * (e.g. `SettingsPanel` se desmonta antes del reconnect) para que cualquier
 * instancia montada al reconectar pueda flushear lo pendiente.
 *
 * Defense-in-depth: capturamos el `unsubscribe` que devuelve `onAuthStateChanged`
 * para poder desregistrar el listener desde `__reset()` (tests) y evitar leaks.
 *
 * @param auth Instancia de Firebase Auth (inyectable para tests). Default: la
 *   instancia compartida de `config/firebase`.
 */
export function createPendingByUserStore<T>(auth: Auth = defaultAuth): PendingByUserStore<T> {
  const pendingByUser = new Map<string, T>();
  let previousUid: string | null = null;

  // Cycle 3 BLOCKER (#323): limpiar snapshot del UID anterior al logout / switch.
  // Sin esto, en multi-cuenta same-browser un snapshot stale de A pisa lo que A
  // configuro desde otro device cuando A vuelve a loguearse y reconecta.
  let unsubscribe: (() => void) | null = onAuthStateChanged(auth, (firebaseUser) => {
    const newUid = firebaseUser?.uid ?? null;
    if (previousUid && previousUid !== newUid) {
      pendingByUser.delete(previousUid);
    }
    previousUid = newUid;
  });

  return {
    set(uid, value) {
      pendingByUser.set(uid, value);
    },
    get(uid) {
      return pendingByUser.get(uid);
    },
    delete(uid) {
      pendingByUser.delete(uid);
    },
    take(uid) {
      const value = pendingByUser.get(uid);
      if (value !== undefined) {
        pendingByUser.delete(uid);
      }
      return value;
    },
    has(uid) {
      return pendingByUser.has(uid);
    },
    __reset() {
      pendingByUser.clear();
      previousUid = null;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
  };
}
