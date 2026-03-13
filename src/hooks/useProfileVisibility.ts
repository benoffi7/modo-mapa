import { useSyncExternalStore, useCallback } from 'react';
import { collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';

// Module-level cache and subscribers
const visibilityCache = new Map<string, boolean>();
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

// Tracks in-flight fetches to avoid duplicate requests
const pendingFetches = new Set<string>();

async function ensureFetched(userIds: string[]): Promise<void> {
  const unique = [...new Set(userIds)];
  const uncached = unique.filter((uid) => !visibilityCache.has(uid) && !pendingFetches.has(uid));

  if (uncached.length === 0) return;

  for (const uid of uncached) pendingFetches.add(uid);

  const batches: string[][] = [];
  for (let i = 0; i < uncached.length; i += 30) {
    batches.push(uncached.slice(i, i + 30));
  }

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
        visibilityCache.set(d.id, d.data().profilePublic === true);
        fetched.add(d.id);
      }
    }

    for (const uid of uncached) {
      if (!fetched.has(uid)) visibilityCache.set(uid, false);
    }
  } catch {
    for (const uid of uncached) visibilityCache.set(uid, false);
  } finally {
    for (const uid of uncached) pendingFetches.delete(uid);
  }

  notifySubscribers();
}

export function useProfileVisibility(userIds: string[]): Map<string, boolean> {
  // Subscribe to cache changes
  useSyncExternalStore(subscribe, getSnapshot);

  // Trigger fetch for uncached ids (fire-and-forget, will notify on completion)
  const hasUncached = userIds.some((uid) => !visibilityCache.has(uid));
  if (hasUncached) {
    ensureFetched(userIds);
  }

  // Build result from cache
  const buildResult = useCallback(() => {
    const result = new Map<string, boolean>();
    for (const uid of userIds) {
      result.set(uid, visibilityCache.get(uid) ?? false);
    }
    return result;
  }, [userIds]);

  return buildResult();
}
