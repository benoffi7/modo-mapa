import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { ratingConverter, commentConverter, userTagConverter, customTagConverter } from '../config/converters';
import { useAuth } from '../context/AuthContext';
import { getBusinessCache, setBusinessCache, invalidateBusinessCache } from './useBusinessDataCache';
import type { Rating, Comment, UserTag, CustomTag } from '../types';

interface UseBusinessDataReturn {
  isFavorite: boolean;
  ratings: Rating[];
  comments: Comment[];
  userTags: UserTag[];
  customTags: CustomTag[];
  isLoading: boolean;
  error: boolean;
  refetch: (collectionName?: 'favorites' | 'ratings' | 'comments' | 'userTags' | 'customTags') => void;
}

const EMPTY: UseBusinessDataReturn = {
  isFavorite: false,
  ratings: [],
  comments: [],
  userTags: [],
  customTags: [],
  isLoading: false,
  error: false,
  refetch: () => {},
};

async function fetchBusinessData(bId: string, uid: string) {
  const favDocId = `${uid}__${bId}`;

  const [favSnap, ratingsSnap, commentsSnap, userTagsSnap, customTagsSnap] = await Promise.all([
    getDoc(doc(db, COLLECTIONS.FAVORITES, favDocId)),
    getDocs(query(
      collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
      where('businessId', '==', bId),
    )),
    getDocs(query(
      collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter),
      where('businessId', '==', bId),
    )),
    getDocs(query(
      collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter),
      where('businessId', '==', bId),
    )),
    getDocs(query(
      collection(db, COLLECTIONS.CUSTOM_TAGS).withConverter(customTagConverter),
      where('userId', '==', uid),
      where('businessId', '==', bId),
    )),
  ]);

  const commentsResult = commentsSnap.docs.map((d) => d.data());
  commentsResult.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const customTagsResult = customTagsSnap.docs.map((d) => d.data());
  customTagsResult.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return {
    isFavorite: favSnap.exists(),
    ratings: ratingsSnap.docs.map((d) => d.data()),
    comments: commentsResult,
    userTags: userTagsSnap.docs.map((d) => d.data()),
    customTags: customTagsResult,
  };
}

export function useBusinessData(businessId: string | null): UseBusinessDataReturn {
  const { user } = useAuth();
  const [data, setData] = useState<{
    isFavorite: boolean;
    ratings: Rating[];
    comments: Comment[];
    userTags: UserTag[];
    customTags: CustomTag[];
  }>({ isFavorite: false, ratings: [], comments: [], userTags: [], customTags: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const fetchIdRef = useRef(0);

  const load = useCallback(async (bId: string, uid: string) => {
    const id = ++fetchIdRef.current;

    const cached = getBusinessCache(bId);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      setError(false);
      return;
    }

    setIsLoading(true);
    setError(false);

    try {
      const result = await fetchBusinessData(bId, uid);
      if (fetchIdRef.current !== id) return; // stale
      setData(result);
      setBusinessCache(bId, result);
    } catch (err) {
      if (fetchIdRef.current !== id) return;
      console.error('Error loading business data:', err);
      setError(true);
    }

    if (fetchIdRef.current === id) {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!businessId || !user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount/dependency change
    load(businessId, user.uid);
  }, [businessId, user, load]);

  const refetch = useCallback(() => {
    if (!businessId || !user) return;
    invalidateBusinessCache(businessId);
    load(businessId, user.uid);
  }, [businessId, user, load]);

  if (!businessId) return EMPTY;

  return { ...data, isLoading, error, refetch };
}
