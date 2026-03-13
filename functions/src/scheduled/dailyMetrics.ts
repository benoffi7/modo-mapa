import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
  const snapshot = await db.collection('userTags').select('tagId').get();
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
    const db = getFirestore();
    const today = new Date().toISOString().slice(0, 10);
    const startOfDay = getStartOfDay();

    // Read pre-aggregated data (1 read instead of 3 full collection scans)
    const [aggregatesSnap, countersSnap, topTags, activeUsers] = await Promise.all([
      db.doc('config/aggregates').get(),
      db.doc('config/counters').get(),
      getTopTags(db),
      countActiveUsers(db, startOfDay),
    ]);

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
        dailyReads: counters.dailyReads ?? 0,
        dailyWrites: counters.dailyWrites ?? 0,
        dailyDeletes: counters.dailyDeletes ?? 0,
      },
      { merge: true },
    );

    // Reset daily counters
    await db.doc('config/counters').set(
      {
        dailyReads: 0,
        dailyWrites: 0,
        dailyDeletes: 0,
      },
      { merge: true },
    );

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
