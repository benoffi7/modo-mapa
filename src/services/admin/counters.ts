import { collection, doc, getDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import type { QueryConstraint } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import { countersConverter, dailyMetricsConverter } from '../../config/adminConverters';
import type { AdminCounters, DailyMetrics } from '../../types/admin';

export async function fetchCounters(): Promise<AdminCounters | null> {
  const snap = await getDoc(
    doc(db, COLLECTIONS.CONFIG, 'counters').withConverter(countersConverter),
  );
  return snap.exists() ? snap.data() : null;
}

export async function fetchDailyMetrics(order: 'asc' | 'desc', maxDocs?: number): Promise<DailyMetrics[]> {
  const constraints: QueryConstraint[] = [orderBy('date', order)];
  if (maxDocs) constraints.push(limit(maxDocs));

  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.DAILY_METRICS).withConverter(dailyMetricsConverter),
      ...constraints,
    ),
  );
  return snap.docs.map((d) => d.data());
}
