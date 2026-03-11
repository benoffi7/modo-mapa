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

  const loadPage = useCallback(async (cursor: QueryDocumentSnapshot<T> | null) => {
    if (!stableRef || !userId) return;

    const isFirstPage = cursor === null;
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
      } else {
        setItems((prev) => [...prev, ...pageItems]);
      }
    } catch (err) {
      console.error('Error loading data:', err);
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
    lastDocRef.current = null;
    await loadPage(null);
  }, [loadPage]);

  return { items, isLoading, isLoadingMore, error, hasMore, loadMore, reload };
}
