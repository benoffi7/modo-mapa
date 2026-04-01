import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { getCountOfflineSafe } from './getCountOfflineSafe';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { userRankingConverter } from '../config/converters';
import { SCORING } from '../constants/rankings';
import type { UserRanking, UserRankingEntry } from '../types';

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

export function getPreviousPeriodKey(type: 'weekly' | 'monthly' | 'yearly' | 'alltime'): string | null {
  if (type === 'alltime') return null;

  const now = new Date();

  if (type === 'yearly') {
    return `yearly_${now.getFullYear() - 1}`;
  }

  if (type === 'monthly') {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = String(prev.getMonth() + 1).padStart(2, '0');
    return `monthly_${prev.getFullYear()}-${month}`;
  }

  // Weekly: previous ISO week
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() - 7);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `weekly_${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function getCurrentPeriodKey(type: 'weekly' | 'monthly' | 'yearly' | 'alltime'): string {
  const now = new Date();

  if (type === 'alltime') {
    return 'alltime';
  }

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

function getPeriodRange(type: 'weekly' | 'monthly' | 'yearly' | 'alltime'): { start: Date; end: Date } {
  const now = new Date();

  if (type === 'alltime') {
    return { start: new Date(2020, 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
  }

  if (type === 'yearly') {
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
  }

  if (type === 'monthly') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  }

  // Weekly: Monday to next Monday
  const weekStart = new Date(now);
  const day = weekStart.getDay() || 7;
  weekStart.setDate(weekStart.getDate() - day + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return { start: weekStart, end: weekEnd };
}

async function countUserDocs(
  collectionName: string,
  userId: string,
  start: Date,
  end: Date,
): Promise<number> {
  return getCountOfflineSafe(
    query(
      collection(db, collectionName),
      where('userId', '==', userId),
      where('createdAt', '>=', Timestamp.fromDate(start)),
      where('createdAt', '<', Timestamp.fromDate(end)),
    ),
  );
}

/**
 * Fetches the user's score from the last N periods of the given type.
 * Returns an array of scores ordered from oldest to newest.
 */
export async function fetchUserScoreHistory(
  userId: string,
  periodType: 'weekly' | 'monthly' | 'yearly' | 'alltime',
  count = 8,
): Promise<number[]> {
  if (periodType === 'alltime') return [];
  const safeCount = Math.min(count, 12);

  const keys: string[] = [];
  const now = new Date();

  for (let i = safeCount - 1; i >= 0; i--) {
    if (periodType === 'monthly') {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      keys.push(`monthly_${d.getFullYear()}-${m}`);
    } else if (periodType === 'yearly') {
      keys.push(`yearly_${now.getFullYear() - i}`);
    } else {
      // weekly
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = utc.getUTCDay() || 7;
      utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      keys.push(`weekly_${utc.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`);
    }
  }

  // Deduplicate keys (can happen at year boundaries)
  const uniqueKeys = [...new Set(keys)];

  const rankings = await Promise.all(uniqueKeys.map((k) => fetchRanking(k)));

  return rankings.map((r) => {
    if (!r) return 0;
    const entry = r.rankings.find((e) => e.userId === userId);
    return entry?.score ?? 0;
  });
}

export async function fetchUserLiveScore(
  userId: string,
  displayName: string,
  periodType: 'weekly' | 'monthly' | 'yearly' | 'alltime',
): Promise<UserRankingEntry> {
  const { start, end } = getPeriodRange(periodType);

  const [comments, ratings, likes, tags, favorites, photos] = await Promise.all([
    countUserDocs(COLLECTIONS.COMMENTS, userId, start, end),
    countUserDocs(COLLECTIONS.RATINGS, userId, start, end),
    countUserDocs(COLLECTIONS.COMMENT_LIKES, userId, start, end),
    countUserDocs(COLLECTIONS.CUSTOM_TAGS, userId, start, end),
    countUserDocs(COLLECTIONS.FAVORITES, userId, start, end),
    getCountOfflineSafe(
      query(
        collection(db, COLLECTIONS.MENU_PHOTOS),
        where('userId', '==', userId),
        where('status', '==', 'approved'),
        where('createdAt', '>=', Timestamp.fromDate(start)),
        where('createdAt', '<', Timestamp.fromDate(end)),
      ),
    ),
  ]);

  const breakdown = { comments, ratings, likes, tags, favorites, photos };
  const score =
    comments * SCORING.comments +
    ratings * SCORING.ratings +
    likes * SCORING.likes +
    tags * SCORING.tags +
    favorites * SCORING.favorites +
    photos * SCORING.photos;

  return { userId, displayName, score, breakdown };
}
