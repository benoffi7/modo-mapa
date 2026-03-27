import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  openReadCacheDb,
  getReadCacheEntry,
  setReadCacheEntry,
  clearReadCache,
  _resetForTest,
} from './readCache';

function resetDb() {
  _resetForTest?.();
}

function makeData(overrides: Record<string, unknown> = {}) {
  return {
    isFavorite: false,
    ratings: [],
    comments: [],
    userTags: [],
    customTags: [],
    userCommentLikes: new Set<string>(),
    priceLevels: [],
    menuPhoto: null,
    ...overrides,
  };
}

describe('readCache', () => {
  beforeEach(async () => {
    resetDb();
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });

  afterEach(() => {
    resetDb();
  });

  it('opens db successfully', async () => {
    const db = await openReadCacheDb();
    expect(db).toBeDefined();
    expect(db.objectStoreNames.contains('businessCache')).toBe(true);
  });

  it('returns null for missing entry', async () => {
    const entry = await getReadCacheEntry('nonexistent');
    expect(entry).toBeNull();
  });

  it('writes and reads an entry', async () => {
    const data = makeData({ isFavorite: true });
    await setReadCacheEntry('biz1', data);

    const entry = await getReadCacheEntry('biz1');
    expect(entry).not.toBeNull();
    expect(entry!.businessId).toBe('biz1');
    expect(entry!.isFavorite).toBe(true);
    expect(entry!.userCommentLikes).toEqual([]); // Set serialized as array
  });

  it('serializes Set<string> as string[]', async () => {
    const data = makeData({
      userCommentLikes: new Set(['c1', 'c2', 'c3']),
    });
    await setReadCacheEntry('biz2', data);

    const entry = await getReadCacheEntry('biz2');
    expect(entry).not.toBeNull();
    expect(entry!.userCommentLikes).toEqual(expect.arrayContaining(['c1', 'c2', 'c3']));
    expect(entry!.userCommentLikes.length).toBe(3);
  });

  it('returns null for expired entries', async () => {
    const data = makeData();
    await setReadCacheEntry('biz3', data);

    // Advance time past TTL (24h + 1ms)
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 24 * 60 * 60 * 1000 + 1);

    const entry = await getReadCacheEntry('biz3');
    expect(entry).toBeNull();

    vi.restoreAllMocks();
  });

  it('evicts LRU entries when exceeding max (20)', async () => {
    // Write 21 entries
    for (let i = 0; i < 21; i++) {
      await setReadCacheEntry(`biz${i}`, makeData());
    }

    // The oldest entry (biz0) should have been evicted
    const evicted = await getReadCacheEntry('biz0');
    expect(evicted).toBeNull();

    // The newest entry should still be there
    const newest = await getReadCacheEntry('biz20');
    expect(newest).not.toBeNull();
  });

  it('clearReadCache removes all entries', async () => {
    await setReadCacheEntry('biz1', makeData());
    await setReadCacheEntry('biz2', makeData());

    await clearReadCache();

    expect(await getReadCacheEntry('biz1')).toBeNull();
    expect(await getReadCacheEntry('biz2')).toBeNull();
  });

  it('overwrites existing entry on re-set', async () => {
    await setReadCacheEntry('biz1', makeData({ isFavorite: false }));
    await setReadCacheEntry('biz1', makeData({ isFavorite: true }));

    const entry = await getReadCacheEntry('biz1');
    expect(entry).not.toBeNull();
    expect(entry!.isFavorite).toBe(true);
  });

  it('updates lastAccessedAt on read', async () => {
    await setReadCacheEntry('biz1', makeData());

    const entry1 = await getReadCacheEntry('biz1');
    const firstAccess = entry1!.lastAccessedAt;

    // Small delay to ensure different timestamp
    vi.spyOn(Date, 'now').mockReturnValue(firstAccess + 1000);

    const entry2 = await getReadCacheEntry('biz1');
    expect(entry2!.lastAccessedAt).toBeGreaterThan(firstAccess);

    vi.restoreAllMocks();
  });
});
