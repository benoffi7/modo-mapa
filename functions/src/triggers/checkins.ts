import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../helpers/env';
import { checkRateLimit } from '../utils/rateLimiter';
import { incrementCounter, trackWrite, trackDelete } from '../utils/counters';
import { logAbuse } from '../utils/abuseLogger';
import { trackFunctionTiming } from '../utils/perfTracker';

/**
 * #322 S3 Fase 4.1: ventana de suspension de creates tras abuso de deletes.
 * Cuando un user excede 20 deletes/dia (deleteCount >= 20 en `onCheckInDeleted`),
 * se escribe un flag `_rateLimits/checkin_create_suspended_{uid}` con
 * `suspendedUntil = Date.now() + SUSPENSION_HOURS * 3_600_000`. Mientras el flag
 * este vigente, `onCheckInCreated` borra el doc creado y loguea abuse en lugar
 * de incrementar el counter.
 *
 * Cierra el vector de churn (create+delete repetido) que el rate limit de creates
 * solo (10/dia) no podia cubrir — un atacante podia: crear 10, borrar 10, crear
 * 10, etc. Con el flag, los deletes contribuyen a una suspension separada.
 */
const SUSPENSION_HOURS = 24;

export const onCheckInCreated = onDocumentCreated(
  'checkins/{checkinId}',
  async (event) => {
    const startMs = performance.now();
    const db = getDb();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const userId = data.userId as string;

    // Rate limit: 10 check-ins per day per user
    const exceeded = await checkRateLimit(
      db,
      { collection: 'checkins', limit: 10, windowType: 'daily' },
      userId,
    );

    if (exceeded) {
      await snap.ref.delete();
      await logAbuse(db, {
        userId,
        type: 'rate_limit',
        collection: 'checkins',
        detail: 'Exceeded daily check-in limit (10)',
      });
      return;
    }

    // #322 Fase 4.1: gate adicional contra abuso de deletes — ver SUSPENSION_HOURS
    // doc al top del archivo. El path es separado del rate limit normal de creates
    // (`checkins`) y del rate limit de deletes (`_rateLimits/checkin_delete_${uid}`)
    // para no colisionar.
    const suspensionRef = db.doc(`_rateLimits/checkin_create_suspended_${userId}`);
    const suspensionSnap = await suspensionRef.get();
    if (suspensionSnap.exists) {
      const suspendedUntil = suspensionSnap.data()?.suspendedUntil as number | undefined;
      if (typeof suspendedUntil === 'number' && suspendedUntil > Date.now()) {
        await snap.ref.delete();
        await logAbuse(db, {
          userId,
          type: 'rate_limit',
          collection: 'checkins',
          detail: `Create suspended until ${new Date(suspendedUntil).toISOString()} due to delete abuse`,
        });
        return;
      }
    }

    await incrementCounter(db, 'checkins', 1);
    await trackWrite(db, 'checkins');
    await trackFunctionTiming('onCheckInCreated', startMs);
  },
);

export const onCheckInDeleted = onDocumentDeleted(
  'checkins/{checkinId}',
  async (event) => {
    const startMs = performance.now();
    const db = getDb();
    const snap = event.data;
    if (!snap) {
      await incrementCounter(db, 'checkins', -1);
      await trackDelete(db, 'checkins');
      return;
    }

    const data = snap.data();
    const userId = data.userId as string;

    // Rate limit check for deletes: 20 per day per user
    // We can't undo a delete, so we only log abuse when exceeded
    const today = new Date().toISOString().slice(0, 10);
    const deleteLimitRef = db.doc(`_rateLimits/checkin_delete_${userId}`);
    const limitSnap = await deleteLimitRef.get();
    const limitData = limitSnap.data();
    const deleteCount = limitData?.date === today ? (limitData.count as number) : 0;

    await deleteLimitRef.set({ date: today, count: deleteCount + 1 }, { merge: true });

    if (deleteCount >= 20) {
      await logAbuse(db, {
        userId,
        type: 'rate_limit',
        collection: 'checkins_delete',
        detail: `Exceeded 20 checkin deletes/day (count: ${deleteCount + 1})`,
      });

      // #322 Fase 4.1: enforcement real ademas del log. Escribe flag de
      // suspension de creates por SUSPENSION_HOURS — `onCheckInCreated` lo
      // lee y aborta el create. Path separado de los counters existentes.
      await db.doc(`_rateLimits/checkin_create_suspended_${userId}`).set({
        suspendedUntil: Date.now() + SUSPENSION_HOURS * 3_600_000,
        reason: 'delete_abuse',
        userId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await incrementCounter(db, 'checkins', -1);
    await trackDelete(db, 'checkins');
    await trackFunctionTiming('onCheckInDeleted', startMs);
  },
);
