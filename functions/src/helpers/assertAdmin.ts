import { HttpsError } from 'firebase-functions/v2/https';
import { IS_EMULATOR } from './env';

export interface AdminAuth {
  uid: string;
  token: {
    admin?: boolean;
    email?: string;
    email_verified?: boolean;
  };
}

/**
 * Verifies the caller has admin custom claim.
 * Returns the validated auth object so callers don't need non-null assertions.
 * In emulator mode, returns a stub auth if none provided.
 */
export function assertAdmin(
  auth: AdminAuth | undefined,
): AdminAuth {
  if (IS_EMULATOR) {
    return auth ?? { uid: 'emulator-admin', token: { admin: true } };
  }

  if (!auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in');
  }

  if (auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Admin only');
  }

  return auth;
}
