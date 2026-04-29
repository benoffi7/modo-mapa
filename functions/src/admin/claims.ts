import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineString } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { IS_EMULATOR, ENFORCE_APP_CHECK_ADMIN } from '../helpers/env';
import { assertAdmin } from '../helpers/assertAdmin';

const ADMIN_EMAIL_PARAM = defineString('ADMIN_EMAIL', {
  description: 'Email of the bootstrap admin (used only for initial setup)',
});

// NO rate limit on setAdminClaim. Threat model (specs #322 S5): el bootstrap es
// email+flag gated; un rate limit de N/hora no mitiga ADMIN_EMAIL comprometido
// (el atacante solo necesita UNA invocacion exitosa). El existing-admin path
// queda naturalmente rate-limited por ser admin-only. Mitigacion ante compromiso
// del email: rotar secret + reset del flag (`docs/procedures/reset-bootstrap-admin.md`).

export const setAdminClaim = onCall<{ targetUid: string }, Promise<{ success: true }>>(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN },
  async (request) => {
    const { targetUid } = request.data ?? {};
    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'targetUid required');
    }

    let via: 'bootstrap' | 'existing_admin' | 'emulator' = 'emulator';

    // Authorization: emulator bypass, existing admin, or bootstrap via email
    if (!IS_EMULATOR) {
      const isExistingAdmin = request.auth?.token.admin === true;
      const isBootstrap =
        request.auth?.token.email_verified === true &&
        request.auth?.token.email === ADMIN_EMAIL_PARAM.value();

      // Fase 5.1 (#322 S5): gate del path bootstrap via `config/bootstrap.adminAssigned`.
      // Una vez asignado el primer admin, la rama bootstrap se cierra y futuras
      // invocaciones requieren `existing_admin === true`. Recovery por perdida
      // de email: ver `docs/procedures/reset-bootstrap-admin.md`.
      let bootstrapAllowed = isBootstrap;
      if (isBootstrap) {
        const db = getFirestore();
        const bootstrapSnap = await db.doc('config/bootstrap').get();
        const adminAssigned = bootstrapSnap.exists && bootstrapSnap.data()?.adminAssigned === true;
        if (adminAssigned) {
          bootstrapAllowed = false;
        }
      }

      if (!isExistingAdmin && !bootstrapAllowed) {
        throw new HttpsError('permission-denied', 'Not authorized to set admin claims');
      }

      via = isExistingAdmin ? 'existing_admin' : 'bootstrap';
    }

    // Merge with existing claims to avoid overwriting other claims
    const user = await getAuth().getUser(targetUid);
    const currentClaims = user.customClaims ?? {};
    await getAuth().setCustomUserClaims(targetUid, { ...currentClaims, admin: true });

    // Fase 5.1: tras assignment exitoso por rama bootstrap, marcar el flag.
    // Idempotente — `set` con `merge: true`. Try/catch deliberado: si este write
    // falla, el claim YA quedo asignado (paso anterior) y el handler NO debe
    // re-throw — engañariamos al cliente con success:false cuando el admin ya
    // existe. Ops debe setear manualmente el flag siguiendo
    // `docs/procedures/reset-bootstrap-admin.md`. Ver specs L614-651.
    if (via === 'bootstrap') {
      try {
        const db = getFirestore();
        await db.doc('config/bootstrap').set(
          {
            adminAssigned: true,
            assignedAt: FieldValue.serverTimestamp(),
            assignedTo: targetUid,
          },
          { merge: true },
        );
      } catch (flagErr) {
        logger.error('Bootstrap flag write FAILED — manual remediation required', {
          targetUid,
          error: flagErr instanceof Error ? flagErr.message : String(flagErr),
          remediation:
            'Set config/bootstrap.adminAssigned manually via reset-bootstrap-admin.md procedure',
        });
        // NO re-throw — claim ya asignado, no engañar al cliente con success:false.
      }
    }

    logger.info('Admin claim set', {
      targetUid,
      setBy: request.auth?.uid ?? 'emulator',
      via,
    });

    return { success: true as const };
  },
);

export const removeAdminClaim = onCall<{ targetUid: string }, Promise<{ success: true }>>(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN },
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
