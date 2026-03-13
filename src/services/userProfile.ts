import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
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
  const userDocPromise = getDoc(userDocRef).catch(() => null);
  const rankingPromise = fetchLatestRanking('monthly').catch(() => null);

  const [userSnap, commentsSnap, ratingsSnap, favoritesSnap, customTagsSnap, photosSnap, monthlyRanking] =
    await Promise.all([
      userDocPromise,
      getDocs(commentsQuery),
      getDocs(ratingsQuery),
      getDocs(favoritesQuery),
      getDocs(customTagsQuery),
      getDocs(photosQuery),
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
