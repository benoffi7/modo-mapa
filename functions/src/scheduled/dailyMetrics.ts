import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getDb } from '../helpers/env';
import { calculatePercentile } from '../utils/perfTracker';

function getStartOfDay(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

interface BusinessCount {
  businessId: string;
  count: number;
}

interface BusinessAvg {
  businessId: string;
  avgScore: number;
  count: number;
}

function topN<T>(entries: [string, T][], getCount: (v: T) => number, n: number): { id: string; value: T }[] {
  return entries
    .sort(([, a], [, b]) => getCount(b) - getCount(a))
    .slice(0, n)
    .map(([id, value]) => ({ id, value }));
}

async function getTopTags(
  db: FirebaseFirestore.Firestore,
): Promise<Array<{ tagId: string; count: number }>> {
  const snapshot = await db.collection('userTags').select('tagId').limit(10000).get();
  const counts = new Map<string, number>();

  for (const doc of snapshot.docs) {
    const tagId = doc.data().tagId as string;
    counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([tagId, count]) => ({ tagId, count }))
    .sort((a, b) => b.count - a.count);
}

async function countActiveUsers(
  db: FirebaseFirestore.Firestore,
  startOfDay: Date,
): Promise<number> {
  const collections = ['comments', 'ratings', 'favorites', 'feedback', 'userTags', 'customTags'];
  const userIds = new Set<string>();

  for (const col of collections) {
    const snapshot = await db
      .collection(col)
      .where('createdAt', '>=', startOfDay)
      .select('userId')
      .get();

    for (const doc of snapshot.docs) {
      userIds.add(doc.data().userId as string);
    }
  }

  return userIds.size;
}

export const dailyMetrics = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'America/Argentina/Buenos_Aires',
  },
  async () => {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const startOfDay = getStartOfDay();

    // Read pre-aggregated data (1 read instead of 3 full collection scans)
    const [aggregatesSnap, countersSnap, topTags, activeUsers, newAccountsSnap] = await Promise.all([
      db.doc('config/aggregates').get(),
      db.doc('config/counters').get(),
      getTopTags(db),
      countActiveUsers(db, startOfDay),
      db.collection('users').where('createdAt', '>=', startOfDay).select('createdAt').get(),
    ]);

    const newAccounts = newAccountsSnap.size;

    const agg = aggregatesSnap.data() ?? {};
    const counters = countersSnap.data() ?? {};

    // Extract rating distribution from aggregates (pre-computed by triggers)
    const ratingDistribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    const aggDist = (agg.ratingDistribution ?? {}) as Record<string, number>;
    for (const key of Object.keys(ratingDistribution)) {
      ratingDistribution[key] = Math.max(0, aggDist[key] ?? 0);
    }

    // Top favorited from pre-aggregated businessFavorites map
    const businessFavorites = (agg.businessFavorites ?? {}) as Record<string, number>;
    const topFavorited: BusinessCount[] = topN(
      Object.entries(businessFavorites),
      (v) => v,
      10,
    ).map(({ id, value }) => ({ businessId: id, count: Math.max(0, value) }));

    // Top commented from pre-aggregated businessComments map
    const businessComments = (agg.businessComments ?? {}) as Record<string, number>;
    const topCommented: BusinessCount[] = topN(
      Object.entries(businessComments),
      (v) => v,
      10,
    ).map(({ id, value }) => ({ businessId: id, count: Math.max(0, value) }));

    // Top rated from pre-aggregated businessRatingCount + businessRatingSum
    const ratingCounts = (agg.businessRatingCount ?? {}) as Record<string, number>;
    const ratingSums = (agg.businessRatingSum ?? {}) as Record<string, number>;
    const topRated: BusinessAvg[] = Object.keys(ratingCounts)
      .filter((bid) => (ratingCounts[bid] ?? 0) > 0)
      .map((bid) => ({
        businessId: bid,
        avgScore: Math.round(((ratingSums[bid] ?? 0) / ratingCounts[bid]) * 10) / 10,
        count: ratingCounts[bid],
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10);

    // ── Performance aggregation ─────────────────────────────────────────
    const yesterday = new Date(startOfDay);
    yesterday.setDate(yesterday.getDate() - 1);

    const [perfSnap, perfCountersSnap] = await Promise.all([
      db.collection('perfMetrics')
        .where('timestamp', '>=', Timestamp.fromDate(yesterday))
        .get(),
      db.doc('config/perfCounters').get(),
    ]);

    type VitalKey = 'lcp' | 'inp' | 'cls' | 'ttfb';
    const vitalArrays: Record<VitalKey, number[]> = { lcp: [], inp: [], cls: [], ttfb: [] };
    const queryAcc: Record<string, { p50s: number[]; p95s: number[] }> = {};

    for (const perfDoc of perfSnap.docs) {
      const data = perfDoc.data();
      const vitals = (data.vitals ?? {}) as Record<string, number | null>;
      for (const key of ['lcp', 'inp', 'cls', 'ttfb'] as VitalKey[]) {
        const val = vitals[key];
        if (typeof val === 'number') vitalArrays[key].push(val);
      }
      const queries = (data.queries ?? {}) as Record<string, { p50?: number; p95?: number }>;
      for (const [name, q] of Object.entries(queries)) {
        if (!queryAcc[name]) queryAcc[name] = { p50s: [], p95s: [] };
        if (typeof q.p50 === 'number') queryAcc[name].p50s.push(q.p50);
        if (typeof q.p95 === 'number') queryAcc[name].p95s.push(q.p95);
      }
    }

    const perfVitals: Record<string, { p50: number; p75: number; p95: number }> = {};
    for (const key of ['lcp', 'inp', 'cls', 'ttfb'] as VitalKey[]) {
      if (vitalArrays[key].length > 0) {
        perfVitals[key] = {
          p50: calculatePercentile(vitalArrays[key], 50),
          p75: calculatePercentile(vitalArrays[key], 75),
          p95: calculatePercentile(vitalArrays[key], 95),
        };
      }
    }

    const perfQueries: Record<string, { p50: number; p95: number }> = {};
    for (const [name, acc] of Object.entries(queryAcc)) {
      perfQueries[name] = {
        p50: calculatePercentile(acc.p50s, 50),
        p95: calculatePercentile(acc.p95s, 50),
      };
    }

    const perfFunctions: Record<string, { p50: number; p95: number; count: number }> = {};
    const perfCountersData = perfCountersSnap.data() ?? {};
    for (const [name, timings] of Object.entries(perfCountersData)) {
      if (Array.isArray(timings) && timings.length > 0) {
        perfFunctions[name] = {
          p50: calculatePercentile(timings as number[], 50),
          p95: calculatePercentile(timings as number[], 95),
          count: timings.length,
        };
      }
    }

    const performance = {
      vitals: perfVitals,
      queries: perfQueries,
      functions: perfFunctions,
      sampleCount: perfSnap.size,
    };

    // Write daily metrics doc
    await db.doc(`dailyMetrics/${today}`).set(
      {
        date: today,
        ratingDistribution,
        topFavorited,
        topCommented,
        topRated,
        topTags,
        activeUsers,
        newAccounts,
        dailyReads: counters.dailyReads ?? 0,
        dailyWrites: counters.dailyWrites ?? 0,
        dailyDeletes: counters.dailyDeletes ?? 0,
        performance,
      },
      { merge: true },
    );

    // Reset daily counters + perf counters
    await Promise.all([
      db.doc('config/counters').set(
        { dailyReads: 0, dailyWrites: 0, dailyDeletes: 0 },
        { merge: true },
      ),
      db.doc('config/perfCounters').delete(),
    ]);

    // Log top writers as abuse log for monitoring
    const writerCollections = ['comments', 'feedback', 'customTags'];
    const writerCounts = new Map<string, number>();

    for (const col of writerCollections) {
      const snap = await db
        .collection(col)
        .where('createdAt', '>=', startOfDay)
        .select('userId')
        .get();

      for (const doc of snap.docs) {
        const uid = doc.data().userId as string;
        writerCounts.set(uid, (writerCounts.get(uid) ?? 0) + 1);
      }
    }

    const topWriters = [...writerCounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    for (const [userId, count] of topWriters) {
      await db.collection('abuseLogs').add({
        userId,
        type: 'top_writers',
        collection: 'all',
        detail: `${count} writes today`,
        timestamp: FieldValue.serverTimestamp(),
      });
    }
  },
);
