import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Rating, Comment, UserTag, CustomTag, PriceLevel, MenuPhoto } from '../types';

// ---------- mock: auth ----------
let mockUser: { uid: string } | null = { uid: 'u1' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// ---------- mock: businessData service ----------
const mockFetchBusinessData = vi.fn();
const mockFetchSingleCollection = vi.fn();
vi.mock('../services/businessData', () => ({
  fetchBusinessData: (...args: unknown[]) => mockFetchBusinessData(...args),
  fetchSingleCollection: (...args: unknown[]) => mockFetchSingleCollection(...args),
}));

// ---------- mock: readCache (IndexedDB Tier 2) ----------
const mockGetReadCacheEntry = vi.fn();
const mockSetReadCacheEntry = vi.fn();
vi.mock('../services/readCache', () => ({
  getReadCacheEntry: (...args: unknown[]) => mockGetReadCacheEntry(...args),
  setReadCacheEntry: (...args: unknown[]) => mockSetReadCacheEntry(...args),
}));

// ---------- mock: in-memory businessDataCache (Tier 1) ----------
const mockGetBusinessCache = vi.fn();
const mockSetBusinessCache = vi.fn();
const mockInvalidateBusinessCache = vi.fn();
const mockPatchBusinessCache = vi.fn();
vi.mock('../services/businessDataCache', () => ({
  getBusinessCache: (...args: unknown[]) => mockGetBusinessCache(...args),
  setBusinessCache: (...args: unknown[]) => mockSetBusinessCache(...args),
  invalidateBusinessCache: (...args: unknown[]) => mockInvalidateBusinessCache(...args),
  patchBusinessCache: (...args: unknown[]) => mockPatchBusinessCache(...args),
}));

vi.mock('../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { useBusinessData } from './useBusinessData';

function emptyFetchResult() {
  return {
    isFavorite: false,
    ratings: [] as Rating[],
    comments: [] as Comment[],
    userTags: [] as UserTag[],
    customTags: [] as CustomTag[],
    userCommentLikes: new Set<string>(),
    priceLevels: [] as PriceLevel[],
    menuPhoto: null as MenuPhoto | null,
  };
}

function readCacheEntry(overrides: Partial<ReturnType<typeof emptyFetchResult>> = {}) {
  const base = emptyFetchResult();
  return {
    ...base,
    ...overrides,
    userCommentLikes: overrides.userCommentLikes
      ? Array.from(overrides.userCommentLikes)
      : [],
    businessId: 'b1',
    timestamp: Date.now(),
    lastAccessedAt: Date.now(),
  };
}

describe('useBusinessData — guards + cache tiers + errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'u1' };
    mockGetBusinessCache.mockReturnValue(null);
    mockGetReadCacheEntry.mockResolvedValue(null);
    mockSetReadCacheEntry.mockResolvedValue(undefined);
    mockFetchBusinessData.mockResolvedValue(emptyFetchResult());
    mockFetchSingleCollection.mockResolvedValue({});
  });

  // --- guards ---

  it('returns EMPTY when businessId is null', () => {
    const { result } = renderHook(() => useBusinessData(null));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isLoadingComments).toBe(false);
    expect(result.current.comments).toEqual([]);
    expect(result.current.refetch).toBeInstanceOf(Function);
    expect(mockFetchBusinessData).not.toHaveBeenCalled();
  });

  it('returns empty-shape (no fetch) when user is null', async () => {
    mockUser = null;
    const { result } = renderHook(() => useBusinessData('b1'));
    expect(result.current.isLoading).toBe(false);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockFetchBusinessData).not.toHaveBeenCalled();
  });

  // --- Tier 1: in-memory cache hit ---

  it('returns cached data from in-memory cache and skips Firestore', async () => {
    const cached = {
      isFavorite: true,
      ratings: [{ id: 'r1' } as unknown as Rating],
      comments: [],
      userTags: [],
      customTags: [],
      userCommentLikes: new Set<string>(),
      priceLevels: [],
      menuPhoto: null,
      timestamp: Date.now(),
    };
    mockGetBusinessCache.mockReturnValue(cached);

    const { result } = renderHook(() => useBusinessData('b1'));

    await waitFor(() => expect(result.current.isFavorite).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.stale).toBe(false);
    expect(mockGetReadCacheEntry).not.toHaveBeenCalled();
    expect(mockFetchBusinessData).not.toHaveBeenCalled();
  });

  // --- Tier 2: IndexedDB read cache ---

  it('serves stale data from read cache while Firestore loads in background', async () => {
    mockGetReadCacheEntry.mockResolvedValue(
      readCacheEntry({ isFavorite: true, userCommentLikes: new Set(['c1']) }),
    );
    // Slow Firestore so we can observe the intermediate stale render
    let resolveFs!: (v: ReturnType<typeof emptyFetchResult>) => void;
    mockFetchBusinessData.mockImplementation(
      () => new Promise((res) => { resolveFs = res; }),
    );

    const { result } = renderHook(() => useBusinessData('b1'));

    await waitFor(() => expect(result.current.isFavorite).toBe(true));
    expect(result.current.stale).toBe(true);
    expect(result.current.userCommentLikes.has('c1')).toBe(true);

    // Now resolve Firestore with the fresh data
    await act(async () => {
      resolveFs({ ...emptyFetchResult(), isFavorite: false });
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.isFavorite).toBe(false);
    expect(result.current.stale).toBe(false);
    expect(mockFetchBusinessData).toHaveBeenCalledTimes(1);
  });

  it('silently ignores IndexedDB read error and falls through to Firestore', async () => {
    mockGetReadCacheEntry.mockRejectedValue(new Error('idb broken'));

    const { result } = renderHook(() => useBusinessData('b1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe(false);
    expect(mockFetchBusinessData).toHaveBeenCalledTimes(1);
  });

  // --- error handling ---

  it('keeps stale data without error flag when Firestore fails after read-cache served', async () => {
    mockGetReadCacheEntry.mockResolvedValue(readCacheEntry({ isFavorite: true }));
    mockFetchBusinessData.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useBusinessData('b1'));

    await waitFor(() => expect(result.current.isFavorite).toBe(true));
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.error).toBe(false);
    expect(result.current.stale).toBe(true);
  });

  it('sets error=true on Firestore failure without read-cache', async () => {
    mockFetchBusinessData.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useBusinessData('b1'));

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isLoadingComments).toBe(false);
  });

  // --- success path writes to both caches ---

  it('writes to in-memory + read cache after successful Firestore fetch', async () => {
    const result = { ...emptyFetchResult(), isFavorite: true };
    mockFetchBusinessData.mockResolvedValue(result);

    const { result: hookResult } = renderHook(() => useBusinessData('b1'));
    await waitFor(() => expect(hookResult.current.isFavorite).toBe(true));

    expect(mockSetBusinessCache).toHaveBeenCalledWith('b1', result);
    expect(mockSetReadCacheEntry).toHaveBeenCalledWith('b1', result);
  });

  it('logs but does not throw when read-cache write fails', async () => {
    mockSetReadCacheEntry.mockRejectedValue(new Error('disk full'));

    const { result } = renderHook(() => useBusinessData('b1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe(false);
  });

  // --- stale request: businessId changes mid-load ---

  it('ignores stale Firestore response when businessId changed during fetch', async () => {
    let resolveFirst!: (v: ReturnType<typeof emptyFetchResult>) => void;
    mockFetchBusinessData.mockImplementationOnce(
      () => new Promise((res) => { resolveFirst = res; }),
    );
    mockFetchBusinessData.mockImplementationOnce(() =>
      Promise.resolve({ ...emptyFetchResult(), isFavorite: true }),
    );

    const { result, rerender } = renderHook(
      ({ bId }: { bId: string | null }) => useBusinessData(bId),
      { initialProps: { bId: 'old' as string | null } },
    );

    rerender({ bId: 'new' });
    await waitFor(() => expect(result.current.isFavorite).toBe(true));

    await act(async () => {
      resolveFirst({ ...emptyFetchResult(), isFavorite: false });
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.isFavorite).toBe(true);
  });

  it('ignores stale read-cache hit when businessId already changed', async () => {
    let resolveIdb!: (v: ReturnType<typeof readCacheEntry>) => void;
    mockGetReadCacheEntry.mockImplementationOnce(
      () => new Promise<ReturnType<typeof readCacheEntry>>((res) => { resolveIdb = res; }),
    );
    mockGetReadCacheEntry.mockResolvedValueOnce(null);

    const { result, rerender } = renderHook(
      ({ bId }: { bId: string | null }) => useBusinessData(bId),
      { initialProps: { bId: 'old' as string | null } },
    );

    rerender({ bId: 'new' });

    await act(async () => {
      resolveIdb(readCacheEntry({ isFavorite: true }));
      await new Promise((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isFavorite).toBe(false);
  });
});
