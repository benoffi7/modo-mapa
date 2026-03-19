import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineString } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';
import { IS_EMULATOR, ENFORCE_APP_CHECK } from '../helpers/env';
import { assertAdmin } from '../helpers/assertAdmin';

const ADMIN_EMAIL_PARAM = defineString('ADMIN_EMAIL', {
  description: 'Email of the bootstrap admin (used only for initial setup)',
});

export const setAdminClaim = onCall<{ targetUid: string }, Promise<{ success: true }>>(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const { targetUid } = request.data ?? {};
    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'targetUid required');
    }

    // Authorization: emulator bypass, existing admin, or bootstrap via email
    if (!IS_EMULATOR) {
      const isExistingAdmin = request.auth?.token.admin === true;
      const isBootstrap =
        request.auth?.token.email_verified === true &&
        request.auth?.token.email === ADMIN_EMAIL_PARAM.value();

      if (!isExistingAdmin && !isBootstrap) {
        throw new HttpsError('permission-denied', 'Not authorized to set admin claims');
      }
    }

    // Merge with existing claims to avoid overwriting other claims
    const user = await getAuth().getUser(targetUid);
    const currentClaims = user.customClaims ?? {};
    await getAuth().setCustomUserClaims(targetUid, { ...currentClaims, admin: true });

    logger.info('Admin claim set', {
      targetUid,
      setBy: request.auth?.uid ?? 'emulator',
    });

    return { success: true as const };
  },
);

export const removeAdminClaim = onCall<{ targetUid: string }, Promise<{ success: true }>>(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const { targetUid } = request.data ?? {};
    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'targetUid required');
    }

    const admin = assertAdmin(request.auth);

    if (admin.uid === targetUid) {
      throw new HttpsError('failed-precondition', 'Cannot remove your own admin claim');
    }

    // Merge with existing claims, remove admin key
    const user = await getAuth().getUser(targetUid);
    const currentClaims = { ...(user.customClaims ?? {}) };
    delete currentClaims.admin;
    await getAuth().setCustomUserClaims(targetUid, currentClaims);

    logger.info('Admin claim removed', {
      targetUid,
      removedBy: admin.uid,
    });

    return { success: true as const };
  },
);
