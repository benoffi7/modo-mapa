import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import type { UserProfile } from '../types';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import {
  userProfileConverter,
  commentConverter,
  ratingConverter,
  favoriteConverter,
  customTagConverter,
  menuPhotoConverter,
} from '../config/converters';
import { getBusinessName } from '../utils/businessHelpers';
import { fetchLatestRanking } from './rankings';
import { logger } from '../utils/logger';
import { measuredGetDoc, measuredGetDocs } from '../utils/perfMetrics';

export interface UserProfileData {
  displayName: string;
  createdAt: Date;
  stats: {
    comments: number;
    ratings: number;
    favorites: number;
    likesReceived: number;
    customTags: number;
    photos: number;
  };
  recentComments: Array<{
    id: string;
    businessId: string;
    businessName: string;
    text: string;
    createdAt: Date;
  }>;
  rankingPosition: number | null;
}

export async function fetchUserProfile(userId: string, fallbackName?: string): Promise<UserProfileData> {
  const userDocRef = doc(db, COLLECTIONS.USERS, userId).withConverter(userProfileConverter);

  const commentsQuery = query(
    collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  );

  const ratingsQuery = query(
    collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
    where('userId', '==', userId),
  );

  const favoritesQuery = query(
    collection(db, COLLECTIONS.FAVORITES).withConverter(favoriteConverter),
    where('userId', '==', userId),
  );

  const customTagsQuery = query(
    collection(db, COLLECTIONS.CUSTOM_TAGS).withConverter(customTagConverter),
    where('userId', '==', userId),
  );

  const photosQuery = query(
    collection(db, COLLECTIONS.MENU_PHOTOS).withConverter(menuPhotoConverter),
    where('userId', '==', userId),
    where('status', '==', 'approved'),
  );

  // User doc may not be readable (rules restrict to owner/admin).
  // Fetch it best-effort; the rest of the data is public.
  const userDocPromise = measuredGetDoc('userProfile_userDoc', userDocRef)
    .catch((err) => { logger.error('[userProfile] getDoc failed:', err); return null; });
  const rankingPromise = fetchLatestRanking('monthly').catch((err) => { logger.error('[userProfile] fetchLatestRanking failed:', err); return null; });

  const [userSnap, commentsSnap, ratingsSnap, favoritesSnap, customTagsSnap, photosSnap, monthlyRanking] =
    await Promise.all([
      userDocPromise,
      measuredGetDocs('userProfile_comments', commentsQuery),
      measuredGetDocs('userProfile_ratings', ratingsQuery),
      measuredGetDocs('userProfile_favorites', favoritesQuery),
      measuredGetDocs('userProfile_customTags', customTagsQuery),
      measuredGetDocs('userProfile_photos', photosQuery),
      rankingPromise,
    ]);

  const userProfile = userSnap?.exists() ? userSnap.data() : null;
  const comments = commentsSnap.docs.map((d) => d.data());

  const likesReceived = comments.reduce((sum, c) => sum + c.likeCount, 0);

  const rankingIdx = monthlyRanking?.rankings.findIndex((r) => r.userId === userId) ?? -1;
  const rankingPosition = rankingIdx >= 0 ? rankingIdx + 1 : null;

  const recentComments = comments.slice(0, 5).map((c) => ({
    id: c.id,
    businessId: c.businessId,
    businessName: getBusinessName(c.businessId),
    text: c.text,
    createdAt: c.createdAt,
  }));

  return {
    displayName: userProfile?.displayName ?? fallbackName ?? 'Anónimo',
    createdAt: userProfile?.createdAt ?? new Date(),
    stats: {
      comments: commentsSnap.size,
      ratings: ratingsSnap.size,
      favorites: favoritesSnap.size,
      likesReceived,
      customTags: customTagsSnap.size,
      photos: photosSnap.size,
    },
    recentComments,
    rankingPosition,
  };
}

/**
 * Fetch a single user profile doc (lightweight — no aggregation).
 * Used by AuthContext on auth state change.
 */
export async function fetchUserProfileDoc(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, COLLECTIONS.USERS, uid).withConverter(userProfileConverter);
  const snap = await measuredGetDoc('userProfile_doc', ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * Update user display name. Creates the doc if it doesn't exist.
 * Receives an already-validated/trimmed name.
 */
export async function updateUserDisplayName(uid: string, name: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.USERS, uid);
  const snap = await measuredGetDoc('userProfile_existsCheck', ref);
  if (snap.exists()) {
    await updateDoc(ref, { displayName: name, displayNameLower: name.toLowerCase() });
  } else {
    await setDoc(ref, {
      displayName: name,
      displayNameLower: name.toLowerCase(),
      createdAt: serverTimestamp(),
    });
  }
}

/**
 * Update user avatar ID.
 */
export async function updateUserAvatar(uid: string, avatarId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(ref, { avatarId });
}
