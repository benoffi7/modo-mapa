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

async function getTopByBusiness(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  limit: number,
): Promise<BusinessCount[]> {
  const snapshot = await db.collection(collectionName).get();
  const counts = new Map<string, number>();

  for (const doc of snapshot.docs) {
    const bid = doc.data().businessId as string;
    counts.set(bid, (counts.get(bid) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([businessId, count]) => ({ businessId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

async function getRatingDistribution(
  db: FirebaseFirestore.Firestore,
): Promise<Record<string, number>> {
  const snapshot = await db.collection('ratings').get();
  const dist: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

  for (const doc of snapshot.docs) {
    const score = String(doc.data().score as number);
    if (score in dist) {
      dist[score]++;
    }
  }

  return dist;
}

async function getTopRated(
  db: FirebaseFirestore.Firestore,
  limit: number,
): Promise<BusinessAvg[]> {
  const snapshot = await db.collection('ratings').get();
  const scores = new Map<string, number[]>();

  for (const doc of snapshot.docs) {
    const bid = doc.data().businessId as string;
    const score = doc.data().score as number;
    const existing = scores.get(bid) ?? [];
    existing.push(score);
    scores.set(bid, existing);
  }

  return [...scores.entries()]
    .map(([businessId, arr]) => ({
      businessId,
      avgScore: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10,
      count: arr.length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, limit);
}

async function getTopTags(
  db: FirebaseFirestore.Firestore,
): Promise<Array<{ tagId: string; count: number }>> {
  const snapshot = await db.collection('userTags').get();
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

    // Run all aggregations
    const [
      ratingDistribution,
      topFavorited,
      topCommented,
      topRated,
      topTags,
      activeUsers,
      countersSnap,
    ] = await Promise.all([
      getRatingDistribution(db),
      getTopByBusiness(db, 'favorites', 10),
      getTopByBusiness(db, 'comments', 10),
      getTopRated(db, 10),
      getTopTags(db),
      countActiveUsers(db, startOfDay),
      db.doc('config/counters').get(),
    ]);

    const counters = countersSnap.data() ?? {};

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
