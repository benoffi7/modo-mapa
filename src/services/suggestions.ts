/**
 * Firestore service for suggestion data queries.
 */
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { favoriteConverter, ratingConverter, userTagConverter } from '../config/converters';
import type { Favorite, Rating, UserTag } from '../types';

export interface UserSuggestionData {
  favorites: Favorite[];
  ratings: Rating[];
  userTags: UserTag[];
}

export async function fetchUserSuggestionData(userId: string): Promise<UserSuggestionData> {
  const [favsSnap, ratingsSnap, tagsSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, COLLECTIONS.FAVORITES).withConverter(favoriteConverter),
        where('userId', '==', userId),
      ),
    ),
    getDocs(
      query(
        collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
        where('userId', '==', userId),
      ),
    ),
    getDocs(
      query(
        collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter),
        where('userId', '==', userId),
      ),
    ),
  ]);

  return {
    favorites: favsSnap.docs.map((d) => d.data()),
    ratings: ratingsSnap.docs.map((d) => d.data()),
    userTags: tagsSnap.docs.map((d) => d.data()),
  };
}
