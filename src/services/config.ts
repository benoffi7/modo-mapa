/**
 * Firestore service for the `config` collection.
 * Reads global app configuration documents.
 */
import { doc, getDoc, type Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';

export interface AppVersionConfig {
  minVersion: string | undefined;
  /**
   * Marca de tiempo del último write desde CI (`scripts/update-min-version.js`).
   * Server-only: no consumido por el cliente hoy, pero persistido para telemetría
   * futura (age del último deploy) y para los tests del script. Backwards-compatible.
   */
  updatedAt?: Timestamp;
  /**
   * Origen runtime del valor devuelto por `fetchAppVersionConfig`. NO se escribe
   * a Firestore; existe sólo para que el hook decida cuándo emitir
   * `EVT_APP_VERSION_ACTIVE` y para facilitar debugging.
   */
  source?: 'server' | 'server-retry' | 'cache' | 'empty' | 'unknown';
}

/**
 * Fetches the appVersion config document.
 * Returns { minVersion: undefined } if the document does not exist.
 */
export async function fetchAppVersionConfig(): Promise<AppVersionConfig> {
  const snap = await getDoc(doc(db, COLLECTIONS.CONFIG, 'appVersion'));
  if (!snap.exists()) return { minVersion: undefined };
  const data = snap.data() as { minVersion?: string };
  return { minVersion: data.minVersion };
}
