import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../constants/cache', () => ({
  QUERY_CACHE_TTL_MS: 1000, // 1 second for testing
}));

import { getCacheKey, invalidateQueryCache, getQueryCache, setQueryCache } from './queryCache';

describe('getCacheKey', () => {
  it('generates key from collection and userId', () => {
    expect(getCacheKey('favorites', 'user1')).toBe('favorites__user1');
  });
});

describe('queryCache', () => {
  beforeEach(() => {
    // Clear cache between tests by invalidating known keys
    invalidateQueryCache('test', 'user1');
    invalidateQueryCache('test', 'user2');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for empty cache', () => {
    expect(getQueryCache('test', 'user1')).toBeNull();
  });

  it('stores and retrieves cache entry', () => {
    const entry = { items: [1, 2, 3], lastDoc: null, hasMore: false, timestamp: Date.now() };
    setQueryCache('test', 'user1', entry);
    expect(getQueryCache('test', 'user1')).toEqual(entry);
  });

  it('returns null for expired cache entry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00'));

    const entry = { items: [1], lastDoc: null, hasMore: false, timestamp: Date.now() };
    setQueryCache('test', 'user1', entry);

    // Advance past TTL (1000ms)
    vi.advanceTimersByTime(1500);
    expect(getQueryCache('test', 'user1')).toBeNull();
  });

  it('returns entry within TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00'));

    const entry = { items: [1], lastDoc: null, hasMore: false, timestamp: Date.now() };
    setQueryCache('test', 'user1', entry);

    // Advance within TTL
    vi.advanceTimersByTime(500);
    expect(getQueryCache('test', 'user1')).toEqual(entry);
  });

  it('invalidates a cached entry', () => {
    const entry = { items: [1], lastDoc: null, hasMore: false, timestamp: Date.now() };
    setQueryCache('test', 'user1', entry);
    invalidateQueryCache('test', 'user1');
    expect(getQueryCache('test', 'user1')).toBeNull();
  });

  it('isolates entries by user', () => {
    const entry1 = { items: [1], lastDoc: null, hasMore: false, timestamp: Date.now() };
    const entry2 = { items: [2], lastDoc: null, hasMore: false, timestamp: Date.now() };
    setQueryCache('test', 'user1', entry1);
    setQueryCache('test', 'user2', entry2);
    expect(getQueryCache('test', 'user1')?.items).toEqual([1]);
    expect(getQueryCache('test', 'user2')?.items).toEqual([2]);
  });
});
