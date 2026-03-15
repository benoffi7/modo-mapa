import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';

const ADMIN_EMAIL_PARAM = defineString('ADMIN_EMAIL', {
  description: 'Email address of the admin user',
});

export function verifyAdmin(request: CallableRequest): void {
  if (!request.auth?.token.email_verified) {
    throw new HttpsError('permission-denied', 'Email no verificado');
  }

  if (request.auth.token.email !== ADMIN_EMAIL_PARAM.value()) {
    throw new HttpsError('permission-denied', 'Admin only');
  }
}
