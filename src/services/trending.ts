import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { trendingDataConverter } from '../config/converters';
import type { TrendingData } from '../types';

export async function fetchTrending(): Promise<TrendingData | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.TRENDING_BUSINESSES, 'current').withConverter(trendingDataConverter));
  if (!snap.exists()) return null;
  return snap.data();
}
