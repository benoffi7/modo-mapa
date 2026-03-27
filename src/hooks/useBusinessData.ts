import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc, documentId } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { ratingConverter, commentConverter, userTagConverter, customTagConverter, priceLevelConverter, menuPhotoConverter } from '../config/converters';
import { useAuth } from '../context/AuthContext';
import { getBusinessCache, setBusinessCache, invalidateBusinessCache, patchBusinessCache } from './useBusinessDataCache';
import type { Rating, Comment, UserTag, CustomTag, PriceLevel, MenuPhoto } from '../types';
import { logger } from '../utils/logger';
import { trackEvent } from '../utils/analytics';
import {
  EVT_BUSINESS_SHEET_PHASE1_MS,
  EVT_BUSINESS_SHEET_PHASE2_MS,
  EVT_BUSINESS_SHEET_CACHE_HIT,
} from '../constants/analyticsEvents';

export interface UseBusinessDataReturn {
  isFavorite: boolean;
  ratings: Rating[];
  comments: Comment[];
  userTags: UserTag[];
  customTags: CustomTag[];
  userCommentLikes: Set<string>;
  priceLevels: PriceLevel[];
  menuPhoto: MenuPhoto | null;
  isLoading: boolean;
  isLoadingComments: boolean;
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
  isLoadingComments: false,
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

/** Phase 1: fast Firestore queries (everything except comments + likes). */
async function fetchPhase1(bId: string, uid: string) {
  const favDocId = `${uid}__${bId}`;

  const [favSnap, ratingsSnap, userTagsSnap, customTagsSnap, priceLevelsSnap, menuPhotoSnap] = await Promise.all([
    getDoc(doc(db, COLLECTIONS.FAVORITES, favDocId)),
    getDocs(query(
      collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
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

  const customTagsResult = customTagsSnap.docs.map((d) => d.data());
  customTagsResult.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return {
    isFavorite: favSnap.exists(),
    ratings: ratingsSnap.docs.map((d) => d.data()),
    userTags: userTagsSnap.docs.map((d) => d.data()),
    customTags: customTagsResult,
    priceLevels: priceLevelsSnap.docs.map((d) => d.data()),
    menuPhoto: menuPhotoSnap.empty ? null : menuPhotoSnap.docs[0].data(),
  };
}

/** Phase 2: slow queries (comments + user likes). */
async function fetchPhase2(bId: string, uid: string) {
  const commentsSnap = await getDocs(query(
    collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter),
    where('businessId', '==', bId),
  ));

  const commentsResult = commentsSnap.docs.map((d) => d.data()).filter((c) => !c.flagged);
  commentsResult.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const userCommentLikes = await fetchUserLikes(uid, commentsResult.map((c) => c.id));

  return {
    comments: commentsResult,
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
    priceLevels: PriceLevel[];
    menuPhoto: MenuPhoto | null;
  }>({ isFavorite: false, ratings: [], comments: [], userTags: [], customTags: [], userCommentLikes: EMPTY_LIKES, priceLevels: [], menuPhoto: null });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
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
      setIsLoadingComments(false);
      setError(false);
      trackEvent(EVT_BUSINESS_SHEET_CACHE_HIT, { business_id: bId });
      return;
    }

    setIsLoading(true);
    setIsLoadingComments(true);
    setError(false);

    const t0 = performance.now();

    try {
      // --- Phase 1: fast data ---
      const phase1 = await fetchPhase1(bId, uid);
      if (fetchIdRef.current !== id) return; // stale

      const phase1Ms = Math.round(performance.now() - t0);
      trackEvent(EVT_BUSINESS_SHEET_PHASE1_MS, { duration_ms: phase1Ms, business_id: bId });

      // Merge phase 1 — keep fields that were patched by partial refetches during this load
      const patched = patchedRef.current;
      setData((prev) => {
        const merged = {
          ...prev,
          ...phase1,
          // Keep comments/likes from previous state (phase 2 hasn't run yet)
          comments: prev.comments,
          userCommentLikes: prev.userCommentLikes,
        };
        if (patched.has('isFavorite')) merged.isFavorite = prev.isFavorite;
        if (patched.has('ratings')) merged.ratings = prev.ratings;
        if (patched.has('userTags')) merged.userTags = prev.userTags;
        if (patched.has('customTags')) merged.customTags = prev.customTags;
        if (patched.has('priceLevels')) merged.priceLevels = prev.priceLevels;
        if (patched.has('menuPhoto')) merged.menuPhoto = prev.menuPhoto;
        return merged;
      });
      setIsLoading(false);

      // --- Phase 2: comments + likes ---
      const t1 = performance.now();
      const phase2 = await fetchPhase2(bId, uid);
      if (fetchIdRef.current !== id) return; // stale

      const phase2Ms = Math.round(performance.now() - t1);
      trackEvent(EVT_BUSINESS_SHEET_PHASE2_MS, { duration_ms: phase2Ms, business_id: bId });

      setData((prev) => {
        const merged = { ...prev, ...phase2 };
        if (patched.has('comments')) {
          merged.comments = prev.comments;
          merged.userCommentLikes = prev.userCommentLikes;
        }
        return merged;
      });

      // Build full result for cache (combine phase1 + phase2)
      const fullResult = { ...phase1, ...phase2 };
      setBusinessCache(bId, fullResult);
    } catch (err) {
      if (fetchIdRef.current !== id) return;
      if (import.meta.env.DEV) logger.error('Error loading business data:', err);
      setError(true);
    }

    if (fetchIdRef.current === id) {
      setIsLoadingComments(false);
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
        if (import.meta.env.DEV) logger.error(`Error refetching ${collectionName}:`, err);
      });
  }, [businessId, user, load]);

  if (!businessId) return EMPTY;

  return { ...data, isLoading, isLoadingComments, error, refetch };
}
