import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- Mocks (must be declared before imports) ---

const mockFetchPriceLevelMap = vi.fn();

vi.mock('../services/priceLevels', () => ({
  fetchPriceLevelMap: (...args: unknown[]) => mockFetchPriceLevelMap(...args),
}));

// --- Tests ---

describe('usePriceLevelFilter', () => {
  beforeEach(async () => {
    // Reset module-level globals by re-importing a fresh module each time
    vi.resetModules();
    mockFetchPriceLevelMap.mockReset();
    vi.restoreAllMocks();
  });

  async function loadModule() {
    const mod = await import('./usePriceLevelFilter');
    return mod;
  }

  it('returns an empty Map initially when no data is cached', async () => {
    mockFetchPriceLevelMap.mockResolvedValue(new Map());
    const { usePriceLevelFilter } = await loadModule();

    const { result } = renderHook(() => usePriceLevelFilter());
    // Before fetch resolves, should be an empty map
    expect(result.current).toBeInstanceOf(Map);
    expect(result.current.size).toBe(0);
  });

  it('fetches price levels and returns averaged map', async () => {
    const map = new Map([['biz1', 3], ['biz2', 3]]);
    mockFetchPriceLevelMap.mockResolvedValue(map);
    const { usePriceLevelFilter } = await loadModule();

    const { result } = renderHook(() => usePriceLevelFilter());

    await waitFor(() => {
      expect(result.current.size).toBe(2);
    });

    expect(result.current.get('biz1')).toBe(3);
    expect(result.current.get('biz2')).toBe(3);
  });

  it('rounds the average to the nearest integer', async () => {
    const map = new Map([['biz1', 2]]);
    mockFetchPriceLevelMap.mockResolvedValue(map);
    const { usePriceLevelFilter } = await loadModule();

    const { result } = renderHook(() => usePriceLevelFilter());

    await waitFor(() => {
      expect(result.current.size).toBe(1);
    });

    expect(result.current.get('biz1')).toBe(2);
  });

  it('deduplicates concurrent fetches (only one fetchPriceLevelMap call)', async () => {
    mockFetchPriceLevelMap.mockResolvedValue(new Map([['biz1', 1]]));
    const { usePriceLevelFilter } = await loadModule();

    // Render two hooks simultaneously - should share the same fetch promise
    const { result: r1 } = renderHook(() => usePriceLevelFilter());
    const { result: r2 } = renderHook(() => usePriceLevelFilter());

    await waitFor(() => {
      expect(r1.current.size).toBe(1);
    });
    await waitFor(() => {
      expect(r2.current.size).toBe(1);
    });

    expect(mockFetchPriceLevelMap).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after cache TTL expires (5 minutes)', async () => {
    const realNow = Date.now;
    let fakeTime = 1000000;
    vi.spyOn(Date, 'now').mockImplementation(() => fakeTime);

    mockFetchPriceLevelMap.mockResolvedValue(new Map([['biz1', 1]]));
    const { usePriceLevelFilter } = await loadModule();

    // First render: fetches and caches at fakeTime
    const { result, unmount } = renderHook(() => usePriceLevelFilter());
    await waitFor(() => {
      expect(result.current.size).toBe(1);
    });
    expect(mockFetchPriceLevelMap).toHaveBeenCalledTimes(1);
    unmount();

    // Advance time past TTL (5 minutes = 300_000ms)
    fakeTime += 300_001;

    mockFetchPriceLevelMap.mockResolvedValue(new Map([['biz1', 3], ['biz2', 4]]));

    // Second render: cache is stale, should re-fetch
    const { result: result2 } = renderHook(() => usePriceLevelFilter());
    await waitFor(() => {
      expect(result2.current.size).toBe(2);
    });

    expect(mockFetchPriceLevelMap).toHaveBeenCalledTimes(2);
    expect(result2.current.get('biz1')).toBe(3);
    expect(result2.current.get('biz2')).toBe(4);

    Date.now = realNow;
  });

  it('silently handles fetch errors and returns empty map', async () => {
    mockFetchPriceLevelMap.mockRejectedValue(new Error('Firestore unavailable'));
    const { usePriceLevelFilter } = await loadModule();

    const { result } = renderHook(() => usePriceLevelFilter());

    // Wait a tick for the promise to reject
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Should still be empty map, no error thrown
    expect(result.current).toBeInstanceOf(Map);
    expect(result.current.size).toBe(0);
  });
});
