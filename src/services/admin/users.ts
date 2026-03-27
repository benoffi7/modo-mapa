import { collection, getDocs, query, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import {
  commentConverter,
  ratingConverter,
  favoriteConverter,
  userTagConverter,
  customTagConverter,
  feedbackConverter,
  userProfileConverter,
  userSettingsConverter,
} from '../../config/converters';
import type { AuthStats, SettingsAggregates } from '../../types/admin';
import type { Comment, Rating, Favorite, UserTag, CustomTag, Feedback, UserProfile, CommentLike } from '../../types';

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

export async function fetchAuthStats(): Promise<AuthStats> {
  const fn = httpsCallable<void, AuthStats>(functions, 'getAuthStats');
  const result = await fn();
  return result.data;
}

export async function fetchSettingsAggregates(): Promise<SettingsAggregates> {
  const snap = await getDocs(collection(db, COLLECTIONS.USER_SETTINGS).withConverter(userSettingsConverter));
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
