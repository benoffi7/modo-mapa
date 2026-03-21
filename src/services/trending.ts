import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import type { TrendingData, TrendingBusiness } from '../types';

export async function fetchTrending(): Promise<TrendingData | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.TRENDING_BUSINESSES, 'current'));
  if (!snap.exists()) return null;

  const raw = snap.data();
  if (!raw.computedAt || !raw.periodStart || !raw.periodEnd) return null;
  return {
    businesses: (raw.businesses ?? []) as TrendingBusiness[],
    computedAt: (raw.computedAt as Timestamp).toDate(),
    periodStart: (raw.periodStart as Timestamp).toDate(),
    periodEnd: (raw.periodEnd as Timestamp).toDate(),
  };
}
