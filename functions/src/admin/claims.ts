import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';
import { IS_EMULATOR } from '../helpers/env';

const ADMIN_EMAIL_PARAM = defineString('ADMIN_EMAIL', {
  description: 'Email address of the admin user',
});

/**
 * Sets admin custom claim on the calling user if their email matches ADMIN_EMAIL.
 * Called from AdminGuard after Google sign-in to establish admin privileges.
 * The custom claim is used by Firestore rules (request.auth.token.admin == true).
 */
export const setAdminClaim = onCall(
  { enforceAppCheck: !IS_EMULATOR },
  async (request: CallableRequest): Promise<{ admin: boolean }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Requires authentication');
    }

    const email = request.auth.token.email;
    const emailVerified = request.auth.token.email_verified;

    if (!emailVerified) {
      throw new HttpsError('permission-denied', 'Email must be verified');
    }

    const isAdmin = email === ADMIN_EMAIL_PARAM.value();

    if (isAdmin) {
      await getAuth().setCustomUserClaims(request.auth.uid, { admin: true });
    }

    return { admin: isAdmin };
  },
);
