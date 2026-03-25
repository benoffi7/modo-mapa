import { getFirestore } from 'firebase-admin/firestore';

export const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

/**
 * App Check enforcement — DISABLED.
 *
 * Staging and production share the same Cloud Functions deployment.
 * Staging client does NOT initialize App Check (no reCAPTCHA key),
 * so enforcing it would block all staging callable requests with 401.
 *
 * Security is guaranteed by:
 * - assertAdmin() for admin-only functions (auth + custom claim)
 * - request.auth check for user-facing functions
 *
 * If a separate Firebase project is created for staging in the future,
 * this can be changed back to `!IS_EMULATOR`.
 */
export const ENFORCE_APP_CHECK = false;

/**
 * App Check enforcement for admin-only callables.
 *
 * DISABLED — staging and production share the same Cloud Functions deployment.
 * Staging client does NOT have App Check (no reCAPTCHA key), so enforcing it
 * blocks all admin callable requests on staging with 401.
 * Security is guaranteed by assertAdmin() (auth + custom claim check).
 */
export const ENFORCE_APP_CHECK_ADMIN = false;

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
