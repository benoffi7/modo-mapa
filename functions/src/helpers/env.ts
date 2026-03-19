import { getFirestore } from 'firebase-admin/firestore';

export const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

/**
 * App Check enforcement. Disabled in emulator.
 * Staging client doesn't initialize App Check, so admin functions
 * that are only called from the admin panel use enforceAppCheck: false
 * and rely on assertAdmin() for security instead.
 */
export const ENFORCE_APP_CHECK = !IS_EMULATOR;

/**
 * Returns the Firestore instance for the given database.
 * Pass databaseId from the client when using a named database (e.g. 'staging').
 * Falls back to default database when omitted.
 */
export function getDb(databaseId?: string) {
  return databaseId ? getFirestore(databaseId) : getFirestore();
}
