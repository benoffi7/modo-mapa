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
  QueryConstraint,
} from 'firebase/firestore';

interface UsePaginatedQueryReturn<T> {
  items: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  loadAll: (maxItems?: number) => Promise<void>;
  reload: () => Promise<void>;
}

import { measureAsync } from '../utils/perfMetrics';
import { invalidateQueryCache, getQueryCache, setQueryCache } from '../services/queryCache';
import { logger } from '../utils/logger';

export { invalidateQueryCache } from '../services/queryCache';

/**
 * Paginated Firestore query hook with "Load more" pattern.
 *
 * @param collectionRef - Collection reference with converter already applied. Pass null to skip query.
 * @param constraints - Firestore query constraints (e.g. [where('userId', '==', uid)]).
 * @param orderByField - Field to order by descending (e.g. 'createdAt').
 * @param pageSize - Number of items per page (default 20).
 * @param cacheKey - Key for query cache (used by invalidateQueryCache). Typically the userId.
 */
export function usePaginatedQuery<T>(
  collectionRef: CollectionReference<T> | null,
  constraints: QueryConstraint[] | string | undefined,
  orderByField: string,
  pageSize = 20,
  cacheKey?: string,
): UsePaginatedQueryReturn<T> {
  // Backward compat: if constraints is a string, treat as userId (old API)
  const resolvedConstraints = useMemo(() => {
    if (typeof constraints === 'string') {
      return [where('userId', '==', constraints)] as QueryConstraint[];
    }
    return constraints ?? null;
  }, [constraints]);

  const resolvedCacheKey = cacheKey ?? (typeof constraints === 'string' ? constraints : undefined);

  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const lastDocRef = useRef<QueryDocumentSnapshot<T> | null>(null);
  const hasMoreRef = useRef(false);

  const stableRef = useMemo(() => collectionRef, [collectionRef]);

  const loadPage = useCallback(async (cursor: QueryDocumentSnapshot<T> | null, skipCache = false) => {
    if (!stableRef || !resolvedConstraints || !resolvedCacheKey) return;

    const isFirstPage = cursor === null;

    // Check cache for first page only
    if (isFirstPage && !skipCache) {
      const cached = getQueryCache(stableRef.path, resolvedCacheKey);
      if (cached) {
        setItems(cached.items as T[]);
        setHasMore(cached.hasMore);
        hasMoreRef.current = cached.hasMore;
        lastDocRef.current = cached.lastDoc as QueryDocumentSnapshot<T> | null;
        setIsLoading(false);
        setError(null);
        return;
      }
    }

    if (isFirstPage) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const queryConstraints = [
        ...resolvedConstraints,
        orderBy(orderByField, 'desc'),
        limit(pageSize + 1),
        ...(cursor ? [startAfter(cursor)] : []),
      ];

      const snapshot = await measureAsync('paginatedQuery', () => getDocs(query(stableRef, ...queryConstraints)));
      const docs = snapshot.docs;
      const hasMoreResults = docs.length > pageSize;
      const pageDocs = hasMoreResults ? docs.slice(0, pageSize) : docs;

      setHasMore(hasMoreResults);
      hasMoreRef.current = hasMoreResults;
      lastDocRef.current = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;

      const pageItems = pageDocs.map((d) => d.data());
      if (isFirstPage) {
        setItems(pageItems);

        // Cache first page
        setQueryCache(stableRef.path, resolvedCacheKey, {
          items: pageItems,
          lastDoc: lastDocRef.current,
          hasMore: hasMoreResults,
          timestamp: Date.now(),
        });
      } else {
        setItems((prev) => [...prev, ...pageItems]);
      }
    } catch (err) {
      logger.error('Error loading data:', err);
      setError('No se pudieron cargar los datos');
    }

    if (isFirstPage) {
      setIsLoading(false);
    } else {
      setIsLoadingMore(false);
    }
  }, [stableRef, resolvedConstraints, resolvedCacheKey, orderByField, pageSize]);

  useEffect(() => {
    lastDocRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount/dependency change
    loadPage(null);
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    await loadPage(lastDocRef.current);
  }, [hasMore, isLoadingMore, loadPage]);

  const loadAll = useCallback(async (maxItems = 200) => {
    let loaded = 0;
    while (hasMoreRef.current && loaded < maxItems) {
      await loadPage(lastDocRef.current);
      loaded += pageSize;
    }
  }, [loadPage, pageSize]);

  const reload = useCallback(async () => {
    if (stableRef && resolvedCacheKey) {
      invalidateQueryCache(stableRef.path, resolvedCacheKey);
    }
    lastDocRef.current = null;
    await loadPage(null, true);
  }, [loadPage, stableRef, resolvedCacheKey]);

  return { items, isLoading, isLoadingMore, error, hasMore, loadMore, loadAll, reload };
}
