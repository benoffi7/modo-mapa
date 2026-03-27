import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import { followConverter, recommendationConverter } from '../../config/converters';
import type { Follow, Recommendation } from '../../types';

export async function fetchRecentFollows(count: number): Promise<Follow[]> {
  const q = query(
    collection(db, COLLECTIONS.FOLLOWS).withConverter(followConverter),
    orderBy('createdAt', 'desc'),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function fetchRecentRecommendations(count: number): Promise<Recommendation[]> {
  const q = query(
    collection(db, COLLECTIONS.RECOMMENDATIONS).withConverter(recommendationConverter),
    orderBy('createdAt', 'desc'),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function fetchFollowStats(): Promise<{ totalFollows: number; topFollowed: Array<{ userId: string; count: number }> }> {
  const snap = await getDocs(collection(db, COLLECTIONS.FOLLOWS).withConverter(followConverter));
  const followedCounts = new Map<string, number>();
  for (const d of snap.docs) {
    const f = d.data();
    followedCounts.set(f.followedId, (followedCounts.get(f.followedId) ?? 0) + 1);
  }
  const topFollowed = [...followedCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, count]) => ({ userId, count }));
  return { totalFollows: snap.size, topFollowed };
}

export async function fetchRecommendationStats(): Promise<{ total: number; read: number; unread: number; readRate: number }> {
  const snap = await getDocs(collection(db, COLLECTIONS.RECOMMENDATIONS).withConverter(recommendationConverter));
  let readCount = 0;
  for (const d of snap.docs) {
    if (d.data().read) readCount++;
  }
  const total = snap.size;
  return { total, read: readCount, unread: total - readCount, readRate: total > 0 ? Math.round((readCount / total) * 100) : 0 };
}
