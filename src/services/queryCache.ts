import { QUERY_CACHE_TTL_MS } from '../constants/cache';

export interface CacheEntry {
  items: unknown[];
  lastDoc: unknown;
  hasMore: boolean;
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry>();

export function getCacheKey(collectionPath: string, userId: string): string {
  return `${collectionPath}__${userId}`;
}

/** Invalidate the first-page cache for a given collection + user. */
export function invalidateQueryCache(collectionPath: string, userId: string): void {
  queryCache.delete(getCacheKey(collectionPath, userId));
}

/** Get a cached entry if it exists and hasn't expired. */
export function getQueryCache(collectionPath: string, userId: string): CacheEntry | null {
  const cached = queryCache.get(getCacheKey(collectionPath, userId));
  if (cached && Date.now() - cached.timestamp < QUERY_CACHE_TTL_MS) {
    return cached;
  }
  return null;
}

/** Set a cache entry. */
export function setQueryCache(collectionPath: string, userId: string, entry: CacheEntry): void {
  queryCache.set(getCacheKey(collectionPath, userId), entry);
}
