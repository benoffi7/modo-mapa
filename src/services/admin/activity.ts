import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import {
  commentConverter,
  ratingConverter,
  favoriteConverter,
  userTagConverter,
  customTagConverter,
  checkinConverter,
} from '../../config/converters';
import type { Comment, Rating, Favorite, UserTag, CustomTag, CommentLike, PriceLevel, CheckIn } from '../../types';

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

export async function fetchRecentCheckins(count: number): Promise<CheckIn[]> {
  const q = query(
    collection(db, COLLECTIONS.CHECKINS).withConverter(checkinConverter),
    orderBy('createdAt', 'desc'),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}
