/**
 * Firestore service for the `config` collection.
 * Reads global app configuration documents.
 */
import { doc, getDocFromServer, FirestoreError, type Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../utils/logger';
import { measuredGetDoc } from '../utils/perfMetrics';
import { FORCE_UPDATE_FETCH_RETRY_DELAYS_MS } from '../constants/timing';

export interface AppVersionConfig {
  minVersion: string | undefined;
  /**
   * Marca de tiempo del último write desde CI (`scripts/update-min-version.js`).
   * Server-only: no consumido por el cliente hoy, pero persistido para telemetría
   * futura (age del último deploy) y para los tests del script. Backwards-compatible.
   */
  updatedAt?: Timestamp;
  /**
   * Origen runtime del valor devuelto. NO se escribe a Firestore; existe sólo para
   * que el hook decida cuándo emitir `EVT_APP_VERSION_ACTIVE`.
   *  - 'server'       → getDocFromServer resolvió en 1er intento
   *  - 'server-retry' → resolvió en intento 2 o 3
   *  - 'cache'        → fallback a getDoc tras 3 fallos retryables
   *  - 'empty'        → doc no existe aún (primer deploy)
   */
  source: 'server' | 'server-retry' | 'cache' | 'empty';
}

const RETRYABLE_CODES = new Set(['unavailable', 'deadline-exceeded']);

function isRetryable(err: unknown): boolean {
  return err instanceof FirestoreError && RETRYABLE_CODES.has(err.code);
}

/**
 * Fetches the appVersion config document from Firestore server.
 * Retries twice on transient errors (unavailable, deadline-exceeded) before
 * falling back to the local Firestore cache.
 */
export async function fetchAppVersionConfig(): Promise<AppVersionConfig> {
  const ref = doc(db, COLLECTIONS.CONFIG, 'appVersion');

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const snap = await getDocFromServer(ref);
      const source: 'server' | 'server-retry' = attempt === 0 ? 'server' : 'server-retry';
      if (!snap.exists()) return { minVersion: undefined, source: 'empty' };
      const data = snap.data() as { minVersion?: string; updatedAt?: Timestamp };
      return { minVersion: data.minVersion, ...(data.updatedAt !== undefined ? { updatedAt: data.updatedAt } : {}), source };
    } catch (e) {
      if (attempt < 2 && isRetryable(e)) {
        await new Promise((r) => setTimeout(r, FORCE_UPDATE_FETCH_RETRY_DELAYS_MS[attempt]));
        continue;
      }
      if (attempt < 2) {
        logger.warn('fetchAppVersionConfig: non-retryable error on getDocFromServer', e);
        break;
      }
      logger.warn('fetchAppVersionConfig: server exhausted retries, falling back to cache', e);
    }
  }

  // Fallback: cache local de Firestore (IndexedDB).
  const snap = await measuredGetDoc('appVersionConfig', ref);
  if (!snap.exists()) return { minVersion: undefined, source: 'empty' };
  const data = snap.data() as { minVersion?: string; updatedAt?: Timestamp };
  return { minVersion: data.minVersion, ...(data.updatedAt !== undefined ? { updatedAt: data.updatedAt } : {}), source: 'cache' };
}
