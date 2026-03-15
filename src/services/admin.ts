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
  query,
  orderBy,
  limit,
  where,
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
} from '../config/converters';
import { countersConverter, dailyMetricsConverter, abuseLogConverter } from '../config/adminConverters';
import type { AdminCounters, DailyMetrics, AbuseLog, AuthStats, NotificationStats, SettingsAggregates } from '../types/admin';
import type { Comment, Rating, Favorite, UserTag, CustomTag, Feedback, UserProfile, MenuPhoto, CommentLike, PriceLevel } from '../types';

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
