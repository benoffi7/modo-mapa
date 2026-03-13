import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { userRankingConverter } from '../config/converters';
import type { UserRanking } from '../types';

export async function fetchRanking(period: string): Promise<UserRanking | null> {
  const snap = await getDoc(
    doc(db, COLLECTIONS.USER_RANKINGS, period).withConverter(userRankingConverter),
  );
  return snap.exists() ? snap.data() : null;
}

export async function fetchLatestRanking(type: 'weekly' | 'monthly' | 'yearly'): Promise<UserRanking | null> {
  const prefix = type === 'weekly' ? 'weekly_' : type === 'monthly' ? 'monthly_' : 'yearly_';

  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.USER_RANKINGS).withConverter(userRankingConverter),
      where('period', '>=', prefix),
      where('period', '<=', prefix + '\uf8ff'),
      orderBy('period', 'desc'),
      limit(1),
    ),
  );

  return snap.empty ? null : snap.docs[0].data();
}

export function getCurrentPeriodKey(type: 'weekly' | 'monthly' | 'yearly'): string {
  const now = new Date();

  if (type === 'yearly') {
    return `yearly_${now.getFullYear()}`;
  }

  if (type === 'monthly') {
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `monthly_${now.getFullYear()}-${month}`;
  }

  // Weekly: ISO week number
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `weekly_${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
