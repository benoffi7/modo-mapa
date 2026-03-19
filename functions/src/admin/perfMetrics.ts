import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { ENFORCE_APP_CHECK, getDb } from '../helpers/env';

const MAX_WRITES_PER_DAY = 5;
const RATE_LIMIT_WINDOW_MS = 86_400_000; // 24 hours

interface PerfMetricsPayload {
  sessionId: string;
  vitals: Record<string, number | null>;
  queries: Record<string, { p50: number; p95: number; count: number }>;
  device: { type: string; connection: string };
  appVersion: string;
}

export const writePerfMetrics = onCall<PerfMetricsPayload>(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request: CallableRequest<PerfMetricsPayload>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Requires authentication');
    }

    const { sessionId, vitals, queries, device, appVersion } = request.data ?? {};

    if (!sessionId || typeof sessionId !== 'string') {
      throw new HttpsError('invalid-argument', 'sessionId required');
    }
    if (!vitals || typeof vitals !== 'object') {
      throw new HttpsError('invalid-argument', 'vitals required');
    }
    if (typeof appVersion !== 'string' || appVersion.length > 20) {
      throw new HttpsError('invalid-argument', 'invalid appVersion');
    }

    const db = getDb();
    const uid = request.auth.uid;

    // Rate limit: max N writes per 24h per user
    const rateLimitRef = db.collection('_rateLimits').doc(`perf_${uid}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(rateLimitRef);
      const data = snap.data() as { count: number; resetAt: number } | undefined;
      const now = Date.now();

      if (data && now < data.resetAt) {
        if (data.count >= MAX_WRITES_PER_DAY) {
          throw new HttpsError('resource-exhausted', 'Rate limit exceeded');
        }
        tx.update(rateLimitRef, { count: data.count + 1 });
      } else {
        tx.set(rateLimitRef, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      }
    });

    // Write the perf metrics doc
    await db.collection('perfMetrics').doc(sessionId).set({
      sessionId,
      userId: uid,
      timestamp: FieldValue.serverTimestamp(),
      vitals,
      queries: queries ?? {},
      device: device ?? {},
      appVersion,
    });

    return { success: true };
  },
);
