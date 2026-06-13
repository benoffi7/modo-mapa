import { doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { trendingDataConverter } from '../config/converters';
import { measuredGetDoc } from '../utils/perfMetrics';
import type { TrendingData } from '../types';

export async function fetchTrending(): Promise<TrendingData | null> {
  const ref = doc(db, COLLECTIONS.TRENDING_BUSINESSES, 'current')
    .withConverter(trendingDataConverter);
  const snap = await measuredGetDoc('trending_fetchCurrent', ref);
  if (!snap.exists()) return null;
  return snap.data();
}
