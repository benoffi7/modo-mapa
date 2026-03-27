import { collection, doc, getDoc, getDocs, updateDoc, query, orderBy, limit, where, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import { feedbackConverter, menuPhotoConverter, trendingDataConverter, userRankingConverter, sharedListConverter } from '../../config/converters';
import { abuseLogConverter, perfMetricsConverter } from '../../config/adminConverters';
import type { AbuseLog, StorageStats, AnalyticsReportResponse, NotificationDetails, NotificationTypeBreakdown, ListStats } from '../../types/admin';
import type { PerfMetricsDoc } from '../../types/perfMetrics';
import type { Feedback, MenuPhoto, TrendingData, UserRanking } from '../../types';

// ── Feedback ───────────────────────────────────────────────────────────

export async function fetchRecentFeedback(count: number): Promise<Feedback[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.FEEDBACK).withConverter(feedbackConverter),
      orderBy('createdAt', 'desc'),
      limit(count),
    ),
  );
  return snap.docs.map((d) => d.data());
}

// ── Menu Photos ───────────────────────────────────────────────────────

export async function fetchPendingPhotos(): Promise<MenuPhoto[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.MENU_PHOTOS).withConverter(menuPhotoConverter),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc'),
    ),
  );
  return snap.docs.map((d) => d.data());
}

export async function fetchAllPhotos(): Promise<MenuPhoto[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.MENU_PHOTOS).withConverter(menuPhotoConverter),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => d.data());
}

// ── Abuse Logs ─────────────────────────────────────────────────────────

export async function fetchAbuseLogs(count: number): Promise<AbuseLog[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.ABUSE_LOGS).withConverter(abuseLogConverter),
      orderBy('timestamp', 'desc'),
      limit(count),
    ),
  );
  return snap.docs.map((d) => d.data());
}

export async function reviewAbuseLog(logId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.ABUSE_LOGS, logId), {
    reviewed: true,
    reviewedAt: serverTimestamp(),
  });
}

export async function dismissAbuseLog(logId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.ABUSE_LOGS, logId), {
    dismissed: true,
  });
}

// ── Rankings & Trending ──────────────────────────────────────────────

export async function fetchLatestRanking(): Promise<UserRanking | null> {
  const q = query(
    collection(db, COLLECTIONS.USER_RANKINGS).withConverter(userRankingConverter),
    orderBy('endDate', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].data();
}

export async function fetchTrendingCurrent(): Promise<TrendingData | null> {
  const snap = await getDoc(
    doc(db, COLLECTIONS.TRENDING_BUSINESSES, 'current').withConverter(trendingDataConverter),
  );
  return snap.exists() ? snap.data() : null;
}

// ── Notifications ────────────────────────────────────────────────────

const NOTIFICATION_TYPES = ['like', 'photo_approved', 'photo_rejected', 'ranking', 'feedback_response', 'comment_reply', 'new_follower', 'recommendation'] as const;

export async function fetchNotificationDetails(): Promise<NotificationDetails> {
  const snap = await getDocs(collection(db, COLLECTIONS.NOTIFICATIONS));
  const byTypeMap = new Map<string, { total: number; read: number }>();

  for (const t of NOTIFICATION_TYPES) {
    byTypeMap.set(t, { total: 0, read: 0 });
  }

  let total = 0;
  let read = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const type = String(data.type ?? 'unknown');
    const isRead = data.read === true;

    total++;
    if (isRead) read++;

    const entry = byTypeMap.get(type);
    if (entry) {
      entry.total++;
      if (isRead) entry.read++;
    } else {
      byTypeMap.set(type, { total: 1, read: isRead ? 1 : 0 });
    }
  }

  const byType: NotificationTypeBreakdown[] = [...byTypeMap.entries()]
    .filter(([, v]) => v.total > 0)
    .map(([type, v]) => ({
      type,
      total: v.total,
      read: v.read,
      readRate: v.total > 0 ? Math.round((v.read / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return { total, read, unread: total - read, byType };
}

// ── Lists ──────────────────────────────────────────────────────────────

export async function fetchListStats(): Promise<ListStats> {
  const snap = await getDocs(
    collection(db, COLLECTIONS.SHARED_LISTS).withConverter(sharedListConverter),
  );

  let publicLists = 0;
  let privateLists = 0;
  let collaborativeLists = 0;
  let totalItems = 0;

  for (const d of snap.docs) {
    const list = d.data();
    if (list.isPublic) publicLists++;
    else privateLists++;
    if (list.editorIds.length > 0) collaborativeLists++;
    totalItems += list.itemCount;
  }

  const totalLists = snap.size;
  const avgItemsPerList = totalLists > 0 ? Math.round(totalItems / totalLists) : 0;

  return { totalLists, publicLists, privateLists, collaborativeLists, totalItems, avgItemsPerList };
}

export async function fetchTopLists(topN = 10): Promise<Array<{ name: string; ownerId: string; itemCount: number; isPublic: boolean }>> {
  const q = query(
    collection(db, COLLECTIONS.SHARED_LISTS).withConverter(sharedListConverter),
    orderBy('itemCount', 'desc'),
    limit(topN),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const list = d.data();
    return { name: list.name, ownerId: list.ownerId, itemCount: list.itemCount, isPublic: list.isPublic };
  });
}

// ── Performance & Storage ──────────────────────────────────────────────

export async function fetchPerfMetrics(maxDocs = 200): Promise<PerfMetricsDoc[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.PERF_METRICS).withConverter(perfMetricsConverter),
      orderBy('timestamp', 'desc'),
      limit(maxDocs),
    ),
  );
  return snap.docs.map((d) => d.data());
}

export async function fetchStorageStats(): Promise<StorageStats> {
  const fn = httpsCallable<void, StorageStats>(functions, 'getStorageStats');
  const result = await fn();
  return result.data;
}

export async function fetchAnalyticsReport(): Promise<AnalyticsReportResponse> {
  const fn = httpsCallable<void, AnalyticsReportResponse>(functions, 'getAnalyticsReport');
  const result = await fn();
  return result.data;
}
