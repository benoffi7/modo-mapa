import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  query,
  getDocs,
  limit,
  startAfter,
  orderBy,
  where,
} from 'firebase/firestore';
import type {
  CollectionReference,
  QueryDocumentSnapshot,
} from 'firebase/firestore';

interface UsePaginatedQueryReturn<T> {
  items: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
}

// --- First-page cache with TTL ---
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

interface CacheEntry {
  items: unknown[];
  lastDoc: unknown;
  hasMore: boolean;
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry>();

function getCacheKey(collectionPath: string, userId: string): string {
  return `${collectionPath}__${userId}`;
}

/** Invalidate the first-page cache for a given collection + user. */
export function invalidateQueryCache(collectionPath: string, userId: string): void {
  queryCache.delete(getCacheKey(collectionPath, userId));
}

/**
 * Paginated Firestore query hook with "Load more" pattern.
 *
 * @param collectionRef - Collection reference with converter already applied. Pass null to skip query.
 * @param userId - User ID for the where('userId', '==', uid) constraint. All lists filter by user.
 * @param orderByField - Field to order by descending (e.g. 'createdAt').
 * @param pageSize - Number of items per page (default 20).
 */
export function usePaginatedQuery<T>(
  collectionRef: CollectionReference<T> | null,
  userId: string | undefined,
  orderByField: string,
  pageSize = 20,
): UsePaginatedQueryReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const lastDocRef = useRef<QueryDocumentSnapshot<T> | null>(null);

  const stableRef = useMemo(() => collectionRef, [collectionRef]);

  const loadPage = useCallback(async (cursor: QueryDocumentSnapshot<T> | null, skipCache = false) => {
    if (!stableRef || !userId) return;

    const isFirstPage = cursor === null;

    // Check cache for first page only
    if (isFirstPage && !skipCache) {
      const cacheKey = getCacheKey(stableRef.path, userId);
      const cached = queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setItems(cached.items as T[]);
        setHasMore(cached.hasMore);
        lastDocRef.current = cached.lastDoc as QueryDocumentSnapshot<T> | null;
        setIsLoading(false);
        setError(false);
        return;
      }
    }

    if (isFirstPage) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(false);

    try {
      const constraints = [
        where('userId', '==', userId),
        orderBy(orderByField, 'desc'),
        limit(pageSize + 1),
        ...(cursor ? [startAfter(cursor)] : []),
      ];

      const snapshot = await getDocs(query(stableRef, ...constraints));
      const docs = snapshot.docs;
      const hasMoreResults = docs.length > pageSize;
      const pageDocs = hasMoreResults ? docs.slice(0, pageSize) : docs;

      setHasMore(hasMoreResults);
      lastDocRef.current = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;

      const pageItems = pageDocs.map((d) => d.data());
      if (isFirstPage) {
        setItems(pageItems);

        // Cache first page
        const cacheKey = getCacheKey(stableRef.path, userId);
        queryCache.set(cacheKey, {
          items: pageItems,
          lastDoc: lastDocRef.current,
          hasMore: hasMoreResults,
          timestamp: Date.now(),
        });
      } else {
        setItems((prev) => [...prev, ...pageItems]);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error loading data:', err);
      setError(true);
    }

    if (isFirstPage) {
      setIsLoading(false);
    } else {
      setIsLoadingMore(false);
    }
  }, [stableRef, userId, orderByField, pageSize]);

  useEffect(() => {
    lastDocRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount/dependency change
    loadPage(null);
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    await loadPage(lastDocRef.current);
  }, [hasMore, isLoadingMore, loadPage]);

  const reload = useCallback(async () => {
    if (stableRef && userId) {
      invalidateQueryCache(stableRef.path, userId);
    }
    lastDocRef.current = null;
    await loadPage(null, true);
  }, [loadPage, stableRef, userId]);

  return { items, isLoading, isLoadingMore, error, hasMore, loadMore, reload };
}
