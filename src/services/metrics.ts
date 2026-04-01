/**
 * Firestore service for the `dailyMetrics` collection.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { publicMetricsConverter } from '../config/metricsConverter';
import type { PublicMetrics } from '../types/metrics';

/**
 * Fetches the daily metrics document for a given date string (YYYY-MM-DD).
 * Returns null if the document does not exist.
 */
export async function fetchDailyMetrics(date: string): Promise<PublicMetrics | null> {
  const snap = await getDoc(
    doc(db, COLLECTIONS.DAILY_METRICS, date).withConverter(publicMetricsConverter),
  );
  if (!snap.exists()) return null;
  return snap.data();
}
