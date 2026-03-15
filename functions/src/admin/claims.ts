import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineString } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';

const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

const ADMIN_EMAIL_PARAM = defineString('ADMIN_EMAIL', {
  description: 'Email of the bootstrap admin (used only for initial setup)',
});

export const setAdminClaim = onCall<{ targetUid: string }, Promise<{ success: true }>>(
  { enforceAppCheck: !IS_EMULATOR },
  async (request) => {
    const { targetUid } = request.data ?? {};
    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'targetUid required');
    }

    if (!IS_EMULATOR) {
      const isExistingAdmin = request.auth?.token.admin === true;
      const isBootstrap =
        request.auth?.token.email_verified === true &&
        request.auth?.token.email === ADMIN_EMAIL_PARAM.value();

      if (!isExistingAdmin && !isBootstrap) {
        throw new HttpsError('permission-denied', 'Not authorized to set admin claims');
      }
    }

    await getAuth().setCustomUserClaims(targetUid, { admin: true });
    logger.info('Admin claim set', {
      targetUid,
      setBy: request.auth?.uid ?? 'emulator',
    });

    return { success: true as const };
  },
);

export const removeAdminClaim = onCall<{ targetUid: string }, Promise<{ success: true }>>(
  { enforceAppCheck: !IS_EMULATOR },
  async (request) => {
    const { targetUid } = request.data ?? {};
    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'targetUid required');
    }

    if (!IS_EMULATOR && request.auth?.token.admin !== true) {
      throw new HttpsError('permission-denied', 'Admin only');
    }

    if (request.auth?.uid === targetUid) {
      throw new HttpsError('failed-precondition', 'Cannot remove your own admin claim');
    }

    await getAuth().setCustomUserClaims(targetUid, { admin: false });
    logger.info('Admin claim removed', {
      targetUid,
      removedBy: request.auth?.uid ?? 'emulator',
    });

    return { success: true as const };
  },
);
