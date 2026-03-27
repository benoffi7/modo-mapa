import type { Rating, Comment, UserTag, CustomTag, PriceLevel, MenuPhoto } from '../types';
import {
  READ_CACHE_DB_NAME,
  READ_CACHE_DB_VERSION,
  READ_CACHE_STORE_NAME,
  READ_CACHE_MAX_ENTRIES,
  READ_CACHE_TTL_MS,
} from '../constants/cache';

/**
 * Serializable version of BusinessCacheEntry for IndexedDB storage.
 * Set<string> is stored as string[] since IndexedDB cannot store Sets.
 * Date fields inside sub-objects are stored as ISO strings.
 */
export interface ReadCacheEntry {
  businessId: string;
  isFavorite: boolean;
  ratings: Rating[];
  comments: Comment[];
  userTags: UserTag[];
  customTags: CustomTag[];
  userCommentLikes: string[]; // Set<string> serialized
  priceLevels: PriceLevel[];
  menuPhoto: MenuPhoto | null;
  timestamp: number;
  lastAccessedAt: number; // for LRU eviction
}

let dbInstance: IDBDatabase | null = null;

export function openReadCacheDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(READ_CACHE_DB_NAME, READ_CACHE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(READ_CACHE_STORE_NAME)) {
        const store = db.createObjectStore(READ_CACHE_STORE_NAME, { keyPath: 'businessId' });
        store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onclose = () => { dbInstance = null; };
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a cached entry. Returns null if missing or expired (beyond TTL).
 * Updates lastAccessedAt on read for LRU tracking.
 */
export async function getReadCacheEntry(businessId: string): Promise<ReadCacheEntry | null> {
  try {
    const db = await openReadCacheDb();
    return new Promise((resolve) => {
      const tx = db.transaction(READ_CACHE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(READ_CACHE_STORE_NAME);
      const getReq = store.get(businessId);

      getReq.onsuccess = () => {
        const entry = getReq.result as ReadCacheEntry | undefined;
        if (!entry) { resolve(null); return; }
        if (Date.now() - entry.timestamp > READ_CACHE_TTL_MS) {
          store.delete(businessId);
          resolve(null);
          return;
        }
        // Update LRU timestamp
        entry.lastAccessedAt = Date.now();
        store.put(entry);
        resolve(entry);
      };

      getReq.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Write an entry to the read cache. Performs LRU eviction if over max entries.
 */
export async function setReadCacheEntry(
  businessId: string,
  data: {
    isFavorite: boolean;
    ratings: Rating[];
    comments: Comment[];
    userTags: UserTag[];
    customTags: CustomTag[];
    userCommentLikes: Set<string>;
    priceLevels: PriceLevel[];
    menuPhoto: MenuPhoto | null;
  },
): Promise<void> {
  try {
    const db = await openReadCacheDb();
    const now = Date.now();

    const entry: ReadCacheEntry = {
      businessId,
      isFavorite: data.isFavorite,
      ratings: data.ratings,
      comments: data.comments,
      userTags: data.userTags,
      customTags: data.customTags,
      userCommentLikes: Array.from(data.userCommentLikes),
      priceLevels: data.priceLevels,
      menuPhoto: data.menuPhoto,
      timestamp: now,
      lastAccessedAt: now,
    };

    await new Promise<void>((resolve) => {
      const tx = db.transaction(READ_CACHE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(READ_CACHE_STORE_NAME);

      // Put the entry first
      store.put(entry);

      // Check count and evict LRU if needed
      const countReq = store.count();
      countReq.onsuccess = () => {
        if (countReq.result > READ_CACHE_MAX_ENTRIES) {
          const excess = countReq.result - READ_CACHE_MAX_ENTRIES;
          const index = store.index('lastAccessedAt');
          let deleted = 0;
          const cursorReq = index.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor && deleted < excess) {
              cursor.delete();
              deleted++;
              cursor.continue();
            }
          };
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // silently fail
    });
  } catch {
    // Cache write failures are non-critical
  }
}

/**
 * Clear all entries from the read cache. Used on logout/account deletion.
 */
export async function clearReadCache(): Promise<void> {
  try {
    const db = await openReadCacheDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(READ_CACHE_STORE_NAME, 'readwrite');
      tx.objectStore(READ_CACHE_STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Clear failures are non-critical
  }
}

/** Reset for testing — clears singleton db instance */
export const _resetForTest: (() => void) | undefined = import.meta.env.DEV
  ? () => {
      if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
      }
    }
  : undefined;
