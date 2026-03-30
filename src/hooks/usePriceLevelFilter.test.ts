import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- Mocks (must be declared before imports) ---

const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ withConverter: vi.fn(() => 'converted-ref') })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: vi.fn((...args: unknown[]) => args),
  limit: vi.fn((n: number) => ({ type: 'limit', value: n })),
}));

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/converters', () => ({ priceLevelConverter: {} }));

// --- Helpers ---

function makePriceLevelDoc(businessId: string, level: number) {
  return { data: () => ({ businessId, level, userId: 'u1', createdAt: new Date(), updatedAt: new Date() }) };
}

function makeSnapshot(docs: ReturnType<typeof makePriceLevelDoc>[]) {
  return { docs };
}

// --- Tests ---

describe('usePriceLevelFilter', () => {
  beforeEach(async () => {
    // Reset module-level globals by re-importing a fresh module each time
    vi.resetModules();
    mockGetDocs.mockReset();
    vi.restoreAllMocks();
  });

  async function loadModule() {
    const mod = await import('./usePriceLevelFilter');
    return mod;
  }

  it('returns an empty Map initially when no data is cached', async () => {
    mockGetDocs.mockResolvedValue(makeSnapshot([]));
    const { usePriceLevelFilter } = await loadModule();

    const { result } = renderHook(() => usePriceLevelFilter());
    // Before fetch resolves, should be an empty map
    expect(result.current).toBeInstanceOf(Map);
    expect(result.current.size).toBe(0);
  });

  it('fetches price levels and returns averaged map', async () => {
    mockGetDocs.mockResolvedValue(makeSnapshot([
      makePriceLevelDoc('biz1', 2),
      makePriceLevelDoc('biz1', 4),
      makePriceLevelDoc('biz2', 3),
    ]));
    const { usePriceLevelFilter } = await loadModule();

    const { result } = renderHook(() => usePriceLevelFilter());

    await waitFor(() => {
      expect(result.current.size).toBe(2);
    });

    // biz1: avg(2,4) = 3
    expect(result.current.get('biz1')).toBe(3);
    // biz2: avg(3) = 3
    expect(result.current.get('biz2')).toBe(3);
  });

  it('rounds the average to the nearest integer', async () => {
    mockGetDocs.mockResolvedValue(makeSnapshot([
      makePriceLevelDoc('biz1', 1),
      makePriceLevelDoc('biz1', 2),
      makePriceLevelDoc('biz1', 2),
    ]));
    const { usePriceLevelFilter } = await loadModule();

    const { result } = renderHook(() => usePriceLevelFilter());

    await waitFor(() => {
      expect(result.current.size).toBe(1);
    });

    // avg(1,2,2) = 1.666... -> rounds to 2
    expect(result.current.get('biz1')).toBe(2);
  });

  it('deduplicates concurrent fetches (only one getDocs call)', async () => {
    mockGetDocs.mockResolvedValue(makeSnapshot([
      makePriceLevelDoc('biz1', 1),
    ]));
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

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after cache TTL expires (5 minutes)', async () => {
    const realNow = Date.now;
    let fakeTime = 1000000;
    vi.spyOn(Date, 'now').mockImplementation(() => fakeTime);

    mockGetDocs.mockResolvedValue(makeSnapshot([
      makePriceLevelDoc('biz1', 1),
    ]));
    const { usePriceLevelFilter } = await loadModule();

    // First render: fetches and caches at fakeTime
    const { result, unmount } = renderHook(() => usePriceLevelFilter());
    await waitFor(() => {
      expect(result.current.size).toBe(1);
    });
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    unmount();

    // Advance time past TTL (5 minutes = 300_000ms)
    fakeTime += 300_001;

    mockGetDocs.mockResolvedValue(makeSnapshot([
      makePriceLevelDoc('biz1', 3),
      makePriceLevelDoc('biz2', 4),
    ]));

    // Second render: cache is stale, should re-fetch
    const { result: result2 } = renderHook(() => usePriceLevelFilter());
    await waitFor(() => {
      expect(result2.current.size).toBe(2);
    });

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    expect(result2.current.get('biz1')).toBe(3);
    expect(result2.current.get('biz2')).toBe(4);

    Date.now = realNow;
  });

  it('silently handles fetch errors and returns empty map', async () => {
    mockGetDocs.mockRejectedValue(new Error('Firestore unavailable'));
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
