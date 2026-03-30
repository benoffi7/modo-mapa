import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getBusinessCache, setBusinessCache, invalidateBusinessCache, patchBusinessCache } from '../services/businessDataCache';
import { getReadCacheEntry, setReadCacheEntry } from '../services/readCache';
import { fetchBusinessData, fetchSingleCollection } from '../services/businessData';
import type { BusinessDataCollectionName } from '../services/businessData';
import type { Rating, Comment, UserTag, CustomTag, PriceLevel, MenuPhoto } from '../types';
import { logger } from '../utils/logger';

type CollectionName = BusinessDataCollectionName;

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
  isLoadingComments: boolean;
  error: boolean;
  stale: boolean;
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
  stale: false,
  refetch: () => {},
};

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
  const [stale, setStale] = useState(false);
  const fetchIdRef = useRef(0);
  // Collections patched by partial refetches while a full load is in-flight.
  // When the full load completes, these fields are kept from prev state
  // instead of being overwritten with stale full-load data.
  const patchedRef = useRef(new Set<string>());

  const load = useCallback(async (bId: string, uid: string) => {
    const id = ++fetchIdRef.current;
    patchedRef.current.clear();

    // Tier 1: In-memory cache (5min TTL, instant)
    const cached = getBusinessCache(bId);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      setError(false);
      setStale(false);
      return;
    }

    // Tier 2: IndexedDB read cache (24h TTL, stale data)
    let servedFromReadCache = false;
    try {
      const readCached = await getReadCacheEntry(bId);
      if (readCached && fetchIdRef.current === id) {
        setData({
          isFavorite: readCached.isFavorite,
          ratings: readCached.ratings,
          comments: readCached.comments,
          userTags: readCached.userTags,
          customTags: readCached.customTags,
          userCommentLikes: new Set(readCached.userCommentLikes),
          priceLevels: readCached.priceLevels,
          menuPhoto: readCached.menuPhoto,
        });
        setStale(true);
        setIsLoading(false);
        setError(false);
        servedFromReadCache = true;
      }
    } catch {
      // IndexedDB read failure is non-critical, continue to Firestore
    }

    if (!servedFromReadCache) {
      setIsLoading(true);
      setIsLoadingComments(true);
      setError(false);
      setStale(false);
    }

    // Tier 3: Firestore (authoritative)
    try {
      const result = await fetchBusinessData(bId, uid);
      if (fetchIdRef.current !== id) return; // stale request
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
      setStale(false);
      setBusinessCache(bId, result);
      // Write to IndexedDB read cache (fire-and-forget)
      setReadCacheEntry(bId, result).catch((e) => logger.warn('[useBusinessData] cache write failed', e));
    } catch (err) {
      if (fetchIdRef.current !== id) return;
      if (import.meta.env.DEV) logger.error('Error loading business data:', err);
      // If we served from read cache, keep showing stale data instead of error
      if (!servedFromReadCache) {
        setError(true);
      }
    }

    if (fetchIdRef.current === id) {
      setIsLoading(false);
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

  return { ...data, isLoading, isLoadingComments, error, stale, refetch };
}
