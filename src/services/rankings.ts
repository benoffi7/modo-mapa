import { collection, doc, getDoc, getDocs, getCountFromServer, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { userRankingConverter } from '../config/converters';
import type { UserRanking, UserRankingEntry } from '../types';

const SCORING = {
  comments: 3,
  ratings: 2,
  likes: 1,
  tags: 1,
  favorites: 1,
  photos: 5,
} as const;

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

function getPeriodRange(type: 'weekly' | 'monthly' | 'yearly'): { start: Date; end: Date } {
  const now = new Date();

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
  const snap = await getCountFromServer(
    query(
      collection(db, collectionName),
      where('userId', '==', userId),
      where('createdAt', '>=', Timestamp.fromDate(start)),
      where('createdAt', '<', Timestamp.fromDate(end)),
    ),
  );
  return snap.data().count;
}

export async function fetchUserLiveScore(
  userId: string,
  displayName: string,
  periodType: 'weekly' | 'monthly' | 'yearly',
): Promise<UserRankingEntry> {
  const { start, end } = getPeriodRange(periodType);

  const [comments, ratings, likes, tags, favorites, photosSnap] = await Promise.all([
    countUserDocs(COLLECTIONS.COMMENTS, userId, start, end),
    countUserDocs(COLLECTIONS.RATINGS, userId, start, end),
    countUserDocs(COLLECTIONS.COMMENT_LIKES, userId, start, end),
    countUserDocs(COLLECTIONS.CUSTOM_TAGS, userId, start, end),
    countUserDocs(COLLECTIONS.FAVORITES, userId, start, end),
    getCountFromServer(
      query(
        collection(db, COLLECTIONS.MENU_PHOTOS),
        where('userId', '==', userId),
        where('status', '==', 'approved'),
        where('createdAt', '>=', Timestamp.fromDate(start)),
        where('createdAt', '<', Timestamp.fromDate(end)),
      ),
    ),
  ]);

  const photos = photosSnap.data().count;
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
