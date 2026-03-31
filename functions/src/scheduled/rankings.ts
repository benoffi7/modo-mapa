import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from '../helpers/env';
import { withCronHeartbeat } from '../utils/cronHeartbeat';

const SCORING = {
  comments: 3,
  ratings: 2,
  likes: 1,
  tags: 1,
  favorites: 1,
  photos: 5,
} as const;

interface ScoreBreakdown {
  comments: number;
  ratings: number;
  likes: number;
  tags: number;
  favorites: number;
  photos: number;
}

interface UserScore {
  userId: string;
  displayName: string;
  score: number;
  breakdown: ScoreBreakdown;
}

async function getUserDisplayNames(
  db: FirebaseFirestore.Firestore,
): Promise<Map<string, string>> {
  const snap = await db.collection('users').select('displayName').get();
  const names = new Map<string, string>();
  for (const doc of snap.docs) {
    names.set(doc.id, (doc.data().displayName as string) || 'Anonimo');
  }
  return names;
}

async function countByUser(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  startDate: Date,
  endDate: Date,
): Promise<Map<string, number>> {
  const snap = await db
    .collection(collectionName)
    .where('createdAt', '>=', Timestamp.fromDate(startDate))
    .where('createdAt', '<', Timestamp.fromDate(endDate))
    .select('userId')
    .get();

  const counts = new Map<string, number>();
  for (const doc of snap.docs) {
    const uid = doc.data().userId as string;
    counts.set(uid, (counts.get(uid) ?? 0) + 1);
  }
  return counts;
}

async function countApprovedPhotos(
  db: FirebaseFirestore.Firestore,
  startDate: Date,
  endDate: Date,
): Promise<Map<string, number>> {
  const snap = await db
    .collection('menuPhotos')
    .where('status', '==', 'approved')
    .where('createdAt', '>=', Timestamp.fromDate(startDate))
    .where('createdAt', '<', Timestamp.fromDate(endDate))
    .select('userId')
    .get();

  const counts = new Map<string, number>();
  for (const doc of snap.docs) {
    const uid = doc.data().userId as string;
    counts.set(uid, (counts.get(uid) ?? 0) + 1);
  }
  return counts;
}

async function computeRanking(
  db: FirebaseFirestore.Firestore,
  startDate: Date,
  endDate: Date,
): Promise<{ scores: UserScore[]; totalParticipants: number }> {
  const [displayNames, comments, ratings, likes, tags, favorites, photos] = await Promise.all([
    getUserDisplayNames(db),
    countByUser(db, 'comments', startDate, endDate),
    countByUser(db, 'ratings', startDate, endDate),
    countByUser(db, 'commentLikes', startDate, endDate),
    countByUser(db, 'customTags', startDate, endDate),
    countByUser(db, 'favorites', startDate, endDate),
    countApprovedPhotos(db, startDate, endDate),
  ]);

  const allUsers = new Set<string>();
  [comments, ratings, likes, tags, favorites, photos].forEach((m) => {
    for (const uid of m.keys()) allUsers.add(uid);
  });

  const scores: UserScore[] = [];
  for (const userId of allUsers) {
    const breakdown: ScoreBreakdown = {
      comments: comments.get(userId) ?? 0,
      ratings: ratings.get(userId) ?? 0,
      likes: likes.get(userId) ?? 0,
      tags: tags.get(userId) ?? 0,
      favorites: favorites.get(userId) ?? 0,
      photos: photos.get(userId) ?? 0,
    };

    const score =
      breakdown.comments * SCORING.comments +
      breakdown.ratings * SCORING.ratings +
      breakdown.likes * SCORING.likes +
      breakdown.tags * SCORING.tags +
      breakdown.favorites * SCORING.favorites +
      breakdown.photos * SCORING.photos;

    if (score > 0) {
      scores.push({
        userId,
        displayName: displayNames.get(userId) ?? 'Anonimo',
        score,
        breakdown,
      });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  const totalParticipants = scores.length;
  const top50 = scores.slice(0, 50);

  return { scores: top50, totalParticipants };
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `weekly_${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

async function runWeeklyRanking(): Promise<string> {
  const db = getDb();
  const now = new Date();

  // Compute for the previous week
  const thisMonday = getWeekStart(now);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);

  const periodKey = getISOWeekKey(lastMonday);
  const { scores, totalParticipants } = await computeRanking(db, lastMonday, thisMonday);

  await db.doc(`userRankings/${periodKey}`).set({
    period: periodKey,
    startDate: Timestamp.fromDate(lastMonday),
    endDate: Timestamp.fromDate(thisMonday),
    rankings: scores,
    totalParticipants,
  });

  return `Weekly ranking ${periodKey}: ${totalParticipants} participants`;
}

export const computeWeeklyRanking = onSchedule(
  {
    schedule: '0 4 * * 1',
    timeZone: 'America/Argentina/Buenos_Aires',
  },
  async () => {
    await withCronHeartbeat('computeWeeklyRanking', runWeeklyRanking);
  },
);

async function runMonthlyRanking(): Promise<string> {
  const db = getDb();
  const now = new Date();

  // Compute for the previous month
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const month = String(startOfLastMonth.getMonth() + 1).padStart(2, '0');
  const periodKey = `monthly_${startOfLastMonth.getFullYear()}-${month}`;

  const { scores, totalParticipants } = await computeRanking(db, startOfLastMonth, startOfThisMonth);

  await db.doc(`userRankings/${periodKey}`).set({
    period: periodKey,
    startDate: Timestamp.fromDate(startOfLastMonth),
    endDate: Timestamp.fromDate(startOfThisMonth),
    rankings: scores,
    totalParticipants,
  });

  return `Monthly ranking ${periodKey}: ${totalParticipants} participants`;
}

export const computeMonthlyRanking = onSchedule(
  {
    schedule: '0 4 1 * *',
    timeZone: 'America/Argentina/Buenos_Aires',
  },
  async () => {
    await withCronHeartbeat('computeMonthlyRanking', runMonthlyRanking);
  },
);

async function runAlltimeRanking(): Promise<string> {
  const db = getDb();
  const allTimeStart = new Date(2020, 0, 1);
  const now = new Date();
  const endDate = new Date(now.getFullYear() + 1, 0, 1);

  const { scores, totalParticipants } = await computeRanking(db, allTimeStart, endDate);

  await db.doc('userRankings/alltime').set({
    period: 'alltime',
    startDate: Timestamp.fromDate(allTimeStart),
    endDate: Timestamp.fromDate(now),
    rankings: scores,
    totalParticipants,
  });

  return `All-time ranking: ${totalParticipants} participants`;
}

export const computeAlltimeRanking = onSchedule(
  {
    schedule: '0 5 * * 1', // every Monday at 5am
    timeZone: 'America/Argentina/Buenos_Aires',
    memory: '1GiB',
    timeoutSeconds: 540,
  },
  async () => {
    await withCronHeartbeat('computeAlltimeRanking', runAlltimeRanking);
  },
);
