import { allBusinesses } from '../hooks/useBusinesses';
import type { Business } from '../types';

let cachedMap: Map<string, Business> | null = null;
let cachedIdsSet: Set<string> | null = null;

/**
 * Singleton Map<id, Business> construido desde `allBusinesses`.
 *
 * Reemplaza el patron O(n) de `allBusinesses.find((b) => b.id === id)` con
 * lookups O(1) amortizados. El Map se construye una vez en el primer acceso
 * y se comparte entre todos los consumers — no construyas tu propio
 * `new Map(allBusinesses.map(...))` en cada componente.
 *
 * El dataset `allBusinesses` es estatico (viene de un JSON importado), por
 * lo que el cache no necesita invalidacion fuera de tests.
 */
export function getBusinessMap(): Map<string, Business> {
  if (cachedMap === null) {
    cachedMap = new Map(allBusinesses.map((b) => [b.id, b]));
  }
  return cachedMap;
}

/**
 * Helper de conveniencia para la operacion mas comun: lookup por id.
 * Retorna undefined si el id no existe.
 */
export function getBusinessById(id: string): Business | undefined {
  return getBusinessMap().get(id);
}

/**
 * Singleton Set<id> construido desde `allBusinesses`.
 *
 * Optimizado para checks de membership repetidos (p. ej. iteracion sobre
 * check-ins verificando si el `businessId` existe en el dataset). Usa la
 * misma semantica lazy + singleton que `getBusinessMap()`.
 *
 * No construyas `new Set(allBusinesses.map((b) => b.id))` localmente — el
 * Set se comparte entre todos los consumers y se invalida coordinadamente
 * con el Map via `__resetBusinessMap()`.
 */
export function getAllBusinessIdsSet(): Set<string> {
  if (cachedIdsSet === null) {
    cachedIdsSet = new Set(allBusinesses.map((b) => b.id));
  }
  return cachedIdsSet;
}

/**
 * Reset interno del cache — SOLO para tests.
 * Resetea AMBOS singletons (Map + Set) en una sola invocacion para mantener
 * la coherencia: ambos derivan del mismo dataset `allBusinesses`, asi que
 * si un test mockea/reemplaza el dataset, ambos caches deben reconstruirse.
 *
 * No usar en codigo de produccion: `allBusinesses` es estatico.
 */
export function __resetBusinessMap(): void {
  cachedMap = null;
  cachedIdsSet = null;
}
