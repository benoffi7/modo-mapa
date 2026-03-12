import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { ratingConverter, commentConverter, userTagConverter, customTagConverter } from '../config/converters';
import { useAuth } from '../context/AuthContext';
import { getBusinessCache, setBusinessCache, invalidateBusinessCache, patchBusinessCache } from './useBusinessDataCache';
import type { Rating, Comment, UserTag, CustomTag } from '../types';

interface UseBusinessDataReturn {
  isFavorite: boolean;
  ratings: Rating[];
  comments: Comment[];
  userTags: UserTag[];
  customTags: CustomTag[];
  userCommentLikes: Set<string>;
  isLoading: boolean;
  error: boolean;
  refetch: (collectionName?: CollectionName) => void;
}

const EMPTY_LIKES = new Set<string>();

const EMPTY: UseBusinessDataReturn = {
  isFavorite: false,
  ratings: [],
  comments: [],
  userTags: [],
  customTags: [],
  userCommentLikes: EMPTY_LIKES,
  isLoading: false,
  error: false,
  refetch: () => {},
};

type CollectionName = 'favorites' | 'ratings' | 'comments' | 'userTags' | 'customTags';

/** Fetch user's likes for a set of comment IDs using individual getDoc calls. */
async function fetchUserLikes(uid: string, commentIds: string[]): Promise<Set<string>> {
  if (commentIds.length === 0) return new Set();
  const checks = commentIds.map((cId) =>
    getDoc(doc(db, COLLECTIONS.COMMENT_LIKES, `${uid}__${cId}`)),
  );
  const snaps = await Promise.all(checks);
  const liked = new Set<string>();
  snaps.forEach((s, i) => {
    if (s.exists()) liked.add(commentIds[i]);
  });
  return liked;
}

async function fetchSingleCollection(bId: string, uid: string, col: CollectionName) {
  switch (col) {
    case 'favorites': {
      const snap = await getDoc(doc(db, COLLECTIONS.FAVORITES, `${uid}__${bId}`));
      return { isFavorite: snap.exists() };
    }
    case 'ratings': {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
        where('businessId', '==', bId),
      ));
      return { ratings: snap.docs.map((d) => d.data()) };
    }
    case 'comments': {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter),
        where('businessId', '==', bId),
      ));
      const result = snap.docs.map((d) => d.data()).filter((c) => !c.flagged);
      result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const userCommentLikes = await fetchUserLikes(uid, result.map((c) => c.id));
      return { comments: result, userCommentLikes };
    }
    case 'userTags': {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.USER_TAGS).withConverter(userTagConverter),
        where('businessId', '==', bId),
      ));
      return { userTags: snap.docs.map((d) => d.data()) };
    }
    case 'customTags': {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.CUSTOM_TAGS).withConverter(customTagConverter),
        where('userId', '==', uid),
        where('businessId', '==', bId),
      ));
      const result = snap.docs.map((d) => d.data());
      result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return { customTags: result };
    }
  }
}

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

  const commentsResult = commentsSnap.docs.map((d) => d.data()).filter((c) => !c.flagged);
  commentsResult.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const customTagsResult = customTagsSnap.docs.map((d) => d.data());
  customTagsResult.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Fetch user likes for comments (after we know comment IDs)
  const userCommentLikes = await fetchUserLikes(uid, commentsResult.map((c) => c.id));

  return {
    isFavorite: favSnap.exists(),
    ratings: ratingsSnap.docs.map((d) => d.data()),
    comments: commentsResult,
    userTags: userTagsSnap.docs.map((d) => d.data()),
    customTags: customTagsResult,
    userCommentLikes,
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
    userCommentLikes: Set<string>;
  }>({ isFavorite: false, ratings: [], comments: [], userTags: [], customTags: [], userCommentLikes: EMPTY_LIKES });
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
      if (import.meta.env.DEV) console.error('Error loading business data:', err);
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

  const refetch = useCallback((collectionName?: CollectionName) => {
    if (!businessId || !user) return;

    if (!collectionName) {
      invalidateBusinessCache(businessId);
      load(businessId, user.uid);
      return;
    }

    const id = ++fetchIdRef.current;
    fetchSingleCollection(businessId, user.uid, collectionName)
      .then((patch) => {
        if (fetchIdRef.current !== id) return;
        setData((prev) => ({ ...prev, ...patch }));
        patchBusinessCache(businessId, patch);
      })
      .catch((err) => {
        if (fetchIdRef.current !== id) return;
        if (import.meta.env.DEV) console.error(`Error refetching ${collectionName}:`, err);
      });
  }, [businessId, user, load]);

  if (!businessId) return EMPTY;

  return { ...data, isLoading, error, refetch };
}
