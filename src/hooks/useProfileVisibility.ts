import { useSyncExternalStore, useCallback } from 'react';
import { collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
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

async function fetchVisibility(userIds: string[]): Promise<void> {
  const toFetch = userIds.filter((uid) => !pendingFetches.has(uid));
  if (toFetch.length === 0) return;

  for (const uid of toFetch) pendingFetches.add(uid);

  const batches: string[][] = [];
  for (let i = 0; i < toFetch.length; i += 30) {
    batches.push(toFetch.slice(i, i + 30));
  }

  const now = Date.now();

  try {
    const snapshots = await Promise.all(
      batches.map((batch) =>
        getDocs(
          query(
            collection(db, COLLECTIONS.USER_SETTINGS),
            where(documentId(), 'in', batch),
          ),
        ),
      ),
    );

    const fetched = new Set<string>();
    for (const snap of snapshots) {
      for (const d of snap.docs) {
        visibilityCache.set(d.id, { value: d.data().profilePublic === true, fetchedAt: now });
        fetched.add(d.id);
      }
    }

    for (const uid of toFetch) {
      if (!fetched.has(uid)) visibilityCache.set(uid, { value: false, fetchedAt: now });
    }
  } catch {
    for (const uid of toFetch) visibilityCache.set(uid, { value: false, fetchedAt: now });
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
    fetchVisibility(needsFetch);
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
