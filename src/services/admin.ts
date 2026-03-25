/**
 * Firestore service for admin-specific queries.
 *
 * Centralizes the read operations used by admin dashboard panels.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import type { QueryConstraint } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import {
  commentConverter,
  ratingConverter,
  favoriteConverter,
  userTagConverter,
  customTagConverter,
  feedbackConverter,
  userProfileConverter,
  menuPhotoConverter,
  trendingDataConverter,
  userRankingConverter,
  sharedListConverter,
  followConverter,
  recommendationConverter,
  checkinConverter,
} from '../config/converters';
import { countersConverter, dailyMetricsConverter, abuseLogConverter, perfMetricsConverter } from '../config/adminConverters';
import type { AdminCounters, DailyMetrics, AbuseLog, AuthStats, NotificationStats, SettingsAggregates, StorageStats, AnalyticsReportResponse, NotificationDetails, NotificationTypeBreakdown, ListStats } from '../types/admin';
import type { PerfMetricsDoc } from '../types/perfMetrics';
import type { Comment, Rating, Favorite, UserTag, CustomTag, Feedback, UserProfile, MenuPhoto, CommentLike, PriceLevel, TrendingData, UserRanking, Follow, Recommendation, CheckIn } from '../types';

// ── Counters ───────────────────────────────────────────────────────────

export async function fetchCounters(): Promise<AdminCounters | null> {
  const snap = await getDoc(
    doc(db, COLLECTIONS.CONFIG, 'counters').withConverter(countersConverter),
  );
  return snap.exists() ? snap.data() : null;
}

// ── Activity feed (last N items per collection) ────────────────────────

export async function fetchRecentComments(count: number): Promise<Comment[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter),
      orderBy('createdAt', 'desc'),
      limit(count),
    ),
  );
  return snap.docs.map((d) => d.data());
}

export async function fetchRecentRatings(count: number): Promise<Rating[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
      orderBy('createdAt', 'desc'),
      limit(count),
    ),
  );
  return snap.docs.map((d) => d.data());
}

export async function fetchRecentFavorites(count: number): Promise<Favorite[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.FAVORITES).withConverter(favoriteConverter),
      orderBy('createdAt', 'desc'),
      limit(count),
    ),
  );
  return snap.docs.map((d) => d.data());
}

export async function fetchRecentUserTags(count: number): Promise<UserTag[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter),
      orderBy('createdAt', 'desc'),
      limit(count),
    ),
  );
  return snap.docs.map((d) => d.data());
}

export async function fetchRecentCustomTags(count: number): Promise<CustomTag[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.CUSTOM_TAGS).withConverter(customTagConverter),
      orderBy('createdAt', 'desc'),
      limit(count),
    ),
  );
  return snap.docs.map((d) => d.data());
}

export async function fetchAllCustomTags(): Promise<CustomTag[]> {
  const snap = await getDocs(
    collection(db, COLLECTIONS.CUSTOM_TAGS).withConverter(customTagConverter),
  );
  return snap.docs.map((d) => d.data());
}

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

// ── Users panel ────────────────────────────────────────────────────────

interface UserCollectionSnapshots {
  users: UserProfile[];
  userIds: string[];
  comments: Comment[];
  ratings: Rating[];
  favorites: Favorite[];
  userTags: UserTag[];
  customTags: CustomTag[];
  feedback: Feedback[];
  commentLikes: CommentLike[];
}

/**
 * Fetch data for the UsersPanel.
 *
 * Uses `limit()` on each collection to cap reads. If a collection has
 * more documents than the limit, the rankings will reflect the sample.
 */
export async function fetchUsersPanelData(maxPerCollection = 500): Promise<UserCollectionSnapshots> {
  const [usersSnap, commentsSnap, ratingsSnap, favoritesSnap, userTagsSnap, customTagsSnap, feedbackSnap, commentLikesSnap] =
    await Promise.all([
      getDocs(collection(db, COLLECTIONS.USERS).withConverter(userProfileConverter)),
      getDocs(query(collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter), limit(maxPerCollection))),
      getDocs(query(collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter), limit(maxPerCollection))),
      getDocs(query(collection(db, COLLECTIONS.FAVORITES).withConverter(favoriteConverter), limit(maxPerCollection))),
      getDocs(query(collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter), limit(maxPerCollection))),
      getDocs(query(collection(db, COLLECTIONS.CUSTOM_TAGS).withConverter(customTagConverter), limit(maxPerCollection))),
      getDocs(query(collection(db, COLLECTIONS.FEEDBACK).withConverter(feedbackConverter), limit(maxPerCollection))),
      getDocs(query(collection(db, COLLECTIONS.COMMENT_LIKES), limit(maxPerCollection))),
    ]);

  return {
    users: usersSnap.docs.map((d) => d.data()),
    userIds: usersSnap.docs.map((d) => d.id),
    comments: commentsSnap.docs.map((d) => d.data()),
    ratings: ratingsSnap.docs.map((d) => d.data()),
    favorites: favoritesSnap.docs.map((d) => d.data()),
    userTags: userTagsSnap.docs.map((d) => d.data()),
    customTags: customTagsSnap.docs.map((d) => d.data()),
    feedback: feedbackSnap.docs.map((d) => d.data()),
    commentLikes: commentLikesSnap.docs.map((d) => {
      const data = d.data();
      return {
        userId: String(data.userId ?? ''),
        commentId: String(data.commentId ?? ''),
        createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt),
      };
    }),
  };
}

// ── Comment Stats (edit/reply counts) ─────────────────────────────────

export async function fetchCommentStats(): Promise<{ edited: number; replies: number; total: number }> {
  const snap = await getDocs(
    collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter),
  );
  let edited = 0;
  let replies = 0;
  for (const d of snap.docs) {
    const c = d.data();
    if (c.updatedAt) edited++;
    if (c.parentId) replies++;
  }
  return { edited, replies, total: snap.size };
}

// ── Daily Metrics ──────────────────────────────────────────────────────

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

// ── Auth Stats (callable) ─────────────────────────────────────────────

export async function fetchAuthStats(): Promise<AuthStats> {
  const fn = httpsCallable<void, AuthStats>(functions, 'getAuthStats');
  const result = await fn();
  return result.data;
}

// ── Notification Stats ────────────────────────────────────────────────

export async function fetchNotificationStats(): Promise<NotificationStats> {
  const snap = await getDocs(collection(db, COLLECTIONS.NOTIFICATIONS));
  let read = 0;
  const byType: Record<string, number> = {};
  for (const d of snap.docs) {
    const data = d.data();
    if (data.read) read++;
    const type = String(data.type ?? 'unknown');
    byType[type] = (byType[type] ?? 0) + 1;
  }
  return { total: snap.size, read, unread: snap.size - read, byType };
}

// ── Settings Aggregates ───────────────────────────────────────────────

export async function fetchSettingsAggregates(): Promise<SettingsAggregates> {
  const snap = await getDocs(collection(db, COLLECTIONS.USER_SETTINGS));
  let publicProfiles = 0;
  let notificationsEnabled = 0;
  let analyticsEnabled = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.profilePublic) publicProfiles++;
    if (data.notificationsEnabled) notificationsEnabled++;
    if (data.analyticsEnabled) analyticsEnabled++;
  }
  return { totalSettings: snap.size, publicProfiles, notificationsEnabled, analyticsEnabled };
}

// ── Recent Price Levels ───────────────────────────────────────────────

export async function fetchRecentPriceLevels(count: number): Promise<PriceLevel[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.PRICE_LEVELS),
      orderBy('createdAt', 'desc'),
      limit(count),
    ),
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      userId: String(data.userId ?? ''),
      businessId: String(data.businessId ?? ''),
      level: Number(data.level ?? 0),
      createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate?.() ?? new Date(data.updatedAt),
    };
  });
}

// ── Performance Metrics ──────────────────────────────────────────────

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

// ── Storage Stats (callable) ─────────────────────────────────────────

export async function fetchStorageStats(): Promise<StorageStats> {
  const fn = httpsCallable<void, StorageStats>(functions, 'getStorageStats');
  const result = await fn();
  return result.data;
}

// ── Analytics Report (callable) ──────────────────────────────────────

export async function fetchAnalyticsReport(): Promise<AnalyticsReportResponse> {
  const fn = httpsCallable<void, AnalyticsReportResponse>(functions, 'getAnalyticsReport');
  const result = await fn();
  return result.data;
}

// ── Recent Comment Likes ──────────────────────────────────────────────

export async function fetchRecentCommentLikes(count: number): Promise<CommentLike[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.COMMENT_LIKES),
      orderBy('createdAt', 'desc'),
      limit(count),
    ),
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      userId: String(data.userId ?? ''),
      commentId: String(data.commentId ?? ''),
      createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt),
    };
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

// ── Notification Details ────────────────────────────────────────────

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

// ── Social ─────────────────────────────────────────────────────────────

export async function fetchRecentFollows(count: number): Promise<Follow[]> {
  const q = query(
    collection(db, COLLECTIONS.FOLLOWS).withConverter(followConverter),
    orderBy('createdAt', 'desc'),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function fetchRecentRecommendations(count: number): Promise<Recommendation[]> {
  const q = query(
    collection(db, COLLECTIONS.RECOMMENDATIONS).withConverter(recommendationConverter),
    orderBy('createdAt', 'desc'),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function fetchFollowStats(): Promise<{ totalFollows: number; topFollowed: Array<{ userId: string; count: number }> }> {
  const snap = await getDocs(collection(db, COLLECTIONS.FOLLOWS).withConverter(followConverter));
  const followedCounts = new Map<string, number>();
  for (const d of snap.docs) {
    const f = d.data();
    followedCounts.set(f.followedId, (followedCounts.get(f.followedId) ?? 0) + 1);
  }
  const topFollowed = [...followedCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, count]) => ({ userId, count }));
  return { totalFollows: snap.size, topFollowed };
}

export async function fetchRecommendationStats(): Promise<{ total: number; read: number; unread: number; readRate: number }> {
  const snap = await getDocs(collection(db, COLLECTIONS.RECOMMENDATIONS).withConverter(recommendationConverter));
  let readCount = 0;
  for (const d of snap.docs) {
    if (d.data().read) readCount++;
  }
  const total = snap.size;
  return { total, read: readCount, unread: total - readCount, readRate: total > 0 ? Math.round((readCount / total) * 100) : 0 };
}

// ── Check-ins ──────────────────────────────────────────────────────────

export async function fetchRecentCheckins(count: number): Promise<CheckIn[]> {
  const q = query(
    collection(db, COLLECTIONS.CHECKINS).withConverter(checkinConverter),
    orderBy('createdAt', 'desc'),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}
