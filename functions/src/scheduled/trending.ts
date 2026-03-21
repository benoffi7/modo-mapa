import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from '../helpers/env';
import { TRENDING_SCORING, TRENDING_MAX_BUSINESSES, TRENDING_WINDOW_DAYS } from '../constants/trending';

export interface BusinessAccumulator {
  ratings: number;
  comments: number;
  userTags: number;
  priceLevels: number;
  listItems: number;
}

export async function countByBusiness(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  since: Date,
): Promise<Map<string, number>> {
  const snap = await db
    .collection(collectionName)
    .where('createdAt', '>=', Timestamp.fromDate(since))
    .select('businessId')
    .get();

  const counts = new Map<string, number>();
  for (const doc of snap.docs) {
    const bid = doc.data().businessId as string;
    if (bid) counts.set(bid, (counts.get(bid) ?? 0) + 1);
  }
  return counts;
}

export async function getBusinessNames(
  db: FirebaseFirestore.Firestore,
  businessIds: string[],
): Promise<Map<string, { name: string; category: string }>> {
  const result = new Map<string, { name: string; category: string }>();
  for (let i = 0; i < businessIds.length; i += 30) {
    const chunk = businessIds.slice(i, i + 30);
    const snap = await db
      .collection('businesses')
      .where('__name__', 'in', chunk)
      .select('name', 'category')
      .get();
    for (const doc of snap.docs) {
      const d = doc.data();
      result.set(doc.id, {
        name: (d.name as string) || 'Sin nombre',
        category: (d.category as string) || '',
      });
    }
  }
  return result;
}

export function computeScores(
  ratings: Map<string, number>,
  comments: Map<string, number>,
  userTags: Map<string, number>,
  priceLevels: Map<string, number>,
  listItems: Map<string, number>,
): Array<{ businessId: string; score: number; breakdown: BusinessAccumulator }> {
  const allBusinessIds = new Set<string>();
  [ratings, comments, userTags, priceLevels, listItems].forEach((m) => {
    for (const bid of m.keys()) allBusinessIds.add(bid);
  });

  const scored: Array<{ businessId: string; score: number; breakdown: BusinessAccumulator }> = [];
  for (const businessId of allBusinessIds) {
    const breakdown: BusinessAccumulator = {
      ratings: ratings.get(businessId) ?? 0,
      comments: comments.get(businessId) ?? 0,
      userTags: userTags.get(businessId) ?? 0,
      priceLevels: priceLevels.get(businessId) ?? 0,
      listItems: listItems.get(businessId) ?? 0,
    };
    const score =
      breakdown.ratings * TRENDING_SCORING.ratings +
      breakdown.comments * TRENDING_SCORING.comments +
      breakdown.userTags * TRENDING_SCORING.userTags +
      breakdown.priceLevels * TRENDING_SCORING.priceLevels +
      breakdown.listItems * TRENDING_SCORING.listItems;

    if (score > 0) scored.push({ businessId, score, breakdown });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, TRENDING_MAX_BUSINESSES);
}

export const computeTrendingBusinesses = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'America/Argentina/Buenos_Aires',
  },
  async () => {
    const db = getDb();
    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - TRENDING_WINDOW_DAYS);

    const [ratings, comments, userTags, priceLevels, listItems] = await Promise.all([
      countByBusiness(db, 'ratings', since),
      countByBusiness(db, 'comments', since),
      countByBusiness(db, 'userTags', since),
      countByBusiness(db, 'priceLevels', since),
      countByBusiness(db, 'listItems', since),
    ]);

    const top = computeScores(ratings, comments, userTags, priceLevels, listItems);

    const nameMap = await getBusinessNames(
      db,
      top.map((s) => s.businessId),
    );

    const businesses = top.map((s, i) => {
      const info = nameMap.get(s.businessId) ?? { name: 'Sin nombre', category: '' };
      return {
        businessId: s.businessId,
        name: info.name,
        category: info.category,
        score: s.score,
        breakdown: s.breakdown,
        rank: i + 1,
      };
    });

    await db.doc('trendingBusinesses/current').set({
      businesses,
      computedAt: Timestamp.fromDate(now),
      periodStart: Timestamp.fromDate(since),
      periodEnd: Timestamp.fromDate(now),
    });
  },
);
