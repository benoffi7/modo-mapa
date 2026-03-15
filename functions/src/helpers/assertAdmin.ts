import { HttpsError } from 'firebase-functions/v2/https';

const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

interface AuthToken {
  admin?: boolean;
  email?: string;
  email_verified?: boolean;
}

export function assertAdmin(
  auth: { uid: string; token: AuthToken } | undefined,
): void {
  if (IS_EMULATOR) return;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in');
  }

  if (auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Admin only');
  }
}
