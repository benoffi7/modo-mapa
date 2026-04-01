import { useSyncExternalStore, useCallback } from 'react';
import { fetchProfileVisibility } from '../services/users';
import { PROFILE_CACHE_TTL_MS } from '../constants/cache';

// Cache entry with timestamp for TTL-based invalidation
interface CacheEntry {
  value: boolean;
  fetchedAt: number;
}

// Module-level cache and subscribers
const visibilityCache = new Map<string, CacheEntry>();
const subscribers = new Set<() => void>();
let cacheVersion = 0;

function notifySubscribers() {
  cacheVersion++;
  for (const cb of subscribers) cb();
}

function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

function getSnapshot() {
  return cacheVersion;
}

function isStale(uid: string): boolean {
  const entry = visibilityCache.get(uid);
  if (!entry) return true;
  return Date.now() - entry.fetchedAt > PROFILE_CACHE_TTL_MS;
}

// Tracks in-flight fetches to avoid duplicate requests
const pendingFetches = new Set<string>();

async function doFetchVisibility(userIds: string[]): Promise<void> {
  const toFetch = userIds.filter((uid) => !pendingFetches.has(uid));
  if (toFetch.length === 0) return;

  for (const uid of toFetch) pendingFetches.add(uid);

  const now = Date.now();

  try {
    const visibilityMap = await fetchProfileVisibility(toFetch);
    for (const [uid, isPublic] of visibilityMap) {
      visibilityCache.set(uid, { value: isPublic, fetchedAt: now });
    }
  } finally {
    for (const uid of toFetch) pendingFetches.delete(uid);
  }

  notifySubscribers();
}

export function useProfileVisibility(userIds: string[]): Map<string, boolean> {
  // Subscribe to cache changes
  useSyncExternalStore(subscribe, getSnapshot);

  // Fetch uncached or stale entries
  const unique = [...new Set(userIds)];
  const needsFetch = unique.filter((uid) => isStale(uid));
  if (needsFetch.length > 0) {
    doFetchVisibility(needsFetch);
  }

  // Build result from cache
  const buildResult = useCallback(() => {
    const result = new Map<string, boolean>();
    for (const uid of userIds) {
      result.set(uid, visibilityCache.get(uid)?.value ?? false);
    }
    return result;
  }, [userIds]);

  return buildResult();
}
