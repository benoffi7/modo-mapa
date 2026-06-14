import { getFirestore } from 'firebase-admin/firestore';
import { defineString } from 'firebase-functions/params';

export const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

/**
 * App Check enforcement for user-facing callables.
 *
 * #342 F3: controlado por el parameter `APP_CHECK_ENFORCEMENT` (Firebase params,
 * default 'disabled'), no por una línea en functions/.env. El valor se fija por
 * entorno en el parameter store: 'enabled' en producción, 'disabled' (o ausente
 * → default) en staging. En emuladores siempre deshabilitado (`!IS_EMULATOR`).
 *
 * Security layers when disabled:
 * - request.auth check for user-facing functions
 * - Firestore rules validate ownership and field whitelists
 * - Server-side rate limiting in Cloud Function triggers
 */
export const ENFORCE_APP_CHECK =
  !IS_EMULATOR &&
  defineString('APP_CHECK_ENFORCEMENT', { default: 'disabled' }).value() === 'enabled';

/**
 * App Check enforcement for admin-only callables.
 *
 * Always enabled in production (admin accesses from production domain with
 * reCAPTCHA Enterprise). Disabled in emulators.
 * Additional security: assertAdmin() verifies auth + custom claim.
 */
export const ENFORCE_APP_CHECK_ADMIN = !IS_EMULATOR;

/** Allowed Firestore database IDs. Only these can be passed from the client. */
const ALLOWED_DATABASE_IDS = new Set(['staging']);

/**
 * Returns the Firestore instance for the given database.
 * Pass databaseId from the client when using a named database (e.g. 'staging').
 * Falls back to default database when omitted or invalid.
 */
export function getDb(databaseId?: string) {
  if (databaseId && !ALLOWED_DATABASE_IDS.has(databaseId)) {
    return getFirestore();
  }
  return databaseId ? getFirestore(databaseId) : getFirestore();
}
