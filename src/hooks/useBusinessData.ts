import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc, documentId } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { ratingConverter, commentConverter, userTagConverter, customTagConverter, priceLevelConverter, menuPhotoConverter } from '../config/converters';
import { useAuth } from '../context/AuthContext';
import { getBusinessCache, setBusinessCache, invalidateBusinessCache, patchBusinessCache } from './useBusinessDataCache';
import type { Rating, Comment, UserTag, CustomTag, PriceLevel, MenuPhoto } from '../types';

interface UseBusinessDataReturn {
  isFavorite: boolean;
  ratings: Rating[];
  comments: Comment[];
  userTags: UserTag[];
  customTags: CustomTag[];
  userCommentLikes: Set<string>;
  priceLevels: PriceLevel[];
  menuPhoto: MenuPhoto | null;
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
  priceLevels: [],
  menuPhoto: null,
  isLoading: false,
  error: false,
  refetch: () => {},
};

type CollectionName = 'favorites' | 'ratings' | 'comments' | 'userTags' | 'customTags' | 'priceLevels' | 'menuPhotos';

/** Fetch user's likes for a set of comment IDs using batched documentId() queries. */
async function fetchUserLikes(uid: string, commentIds: string[]): Promise<Set<string>> {
  if (commentIds.length === 0) return new Set();

  // Firestore 'in' queries support max 30 values per batch
  const docIds = commentIds.map((cId) => `${uid}__${cId}`);
  const BATCH_SIZE = 30;
  const liked = new Set<string>();

  for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
    const batch = docIds.slice(i, i + BATCH_SIZE);
    const snap = await getDocs(query(
      collection(db, COLLECTIONS.COMMENT_LIKES),
      where(documentId(), 'in', batch),
    ));
    for (const d of snap.docs) {
      // Doc ID format: {userId}__{commentId} — extract commentId
      const commentId = d.id.split('__')[1];
      liked.add(commentId);
    }
  }

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
    case 'priceLevels': {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.PRICE_LEVELS).withConverter(priceLevelConverter),
        where('businessId', '==', bId),
      ));
      return { priceLevels: snap.docs.map((d) => d.data()) };
    }
    case 'menuPhotos': {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.MENU_PHOTOS).withConverter(menuPhotoConverter),
        where('businessId', '==', bId),
        where('status', '==', 'approved'),
      ));
      return { menuPhoto: snap.empty ? null : snap.docs[0].data() };
    }
  }
}

async function fetchBusinessData(bId: string, uid: string) {
  const favDocId = `${uid}__${bId}`;

  const [favSnap, ratingsSnap, commentsSnap, userTagsSnap, customTagsSnap, priceLevelsSnap, menuPhotoSnap] = await Promise.all([
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
    getDocs(query(
      collection(db, COLLECTIONS.PRICE_LEVELS).withConverter(priceLevelConverter),
      where('businessId', '==', bId),
    )),
    getDocs(query(
      collection(db, COLLECTIONS.MENU_PHOTOS).withConverter(menuPhotoConverter),
      where('businessId', '==', bId),
      where('status', '==', 'approved'),
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
    priceLevels: priceLevelsSnap.docs.map((d) => d.data()),
    menuPhoto: menuPhotoSnap.empty ? null : menuPhotoSnap.docs[0].data(),
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
    priceLevels: PriceLevel[];
    menuPhoto: MenuPhoto | null;
  }>({ isFavorite: false, ratings: [], comments: [], userTags: [], customTags: [], userCommentLikes: EMPTY_LIKES, priceLevels: [], menuPhoto: null });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const fetchIdRef = useRef(0);
  // Collections patched by partial refetches while a full load is in-flight.
  // When the full load completes, these fields are kept from prev state
  // instead of being overwritten with stale full-load data.
  const patchedRef = useRef(new Set<string>());

  const load = useCallback(async (bId: string, uid: string) => {
    const id = ++fetchIdRef.current;
    patchedRef.current.clear();

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
      // Merge: keep fields that were patched by partial refetches during this load
      const patched = patchedRef.current;
      if (patched.size > 0) {
        setData((prev) => {
          const merged = { ...result };
          if (patched.has('isFavorite')) merged.isFavorite = prev.isFavorite;
          if (patched.has('ratings')) merged.ratings = prev.ratings;
          if (patched.has('comments')) { merged.comments = prev.comments; merged.userCommentLikes = prev.userCommentLikes; }
          if (patched.has('userTags')) merged.userTags = prev.userTags;
          if (patched.has('customTags')) merged.customTags = prev.customTags;
          if (patched.has('priceLevels')) merged.priceLevels = prev.priceLevels;
          if (patched.has('menuPhoto')) merged.menuPhoto = prev.menuPhoto;
          return merged;
        });
      } else {
        setData(result);
      }
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

    // Don't increment fetchIdRef for partial refetches — a single-collection
    // refresh must not cancel a pending full load (race condition: user votes
    // on price level while initial data is still loading).
    // Track the patched collection so the full load won't overwrite it.
    patchedRef.current.add(collectionName);
    fetchSingleCollection(businessId, user.uid, collectionName)
      .then((patch) => {
        setData((prev) => ({ ...prev, ...patch }));
        patchBusinessCache(businessId, patch);
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.error(`Error refetching ${collectionName}:`, err);
      });
  }, [businessId, user, load]);

  if (!businessId) return EMPTY;

  return { ...data, isLoading, error, refetch };
}
