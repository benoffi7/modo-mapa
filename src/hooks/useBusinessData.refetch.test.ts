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

const mockGetReadCacheEntry = vi.fn();
const mockSetReadCacheEntry = vi.fn();
vi.mock('../services/readCache', () => ({
  getReadCacheEntry: (...args: unknown[]) => mockGetReadCacheEntry(...args),
  setReadCacheEntry: (...args: unknown[]) => mockSetReadCacheEntry(...args),
}));

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

describe('useBusinessData — refetch + partial-load merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'u1' };
    mockGetBusinessCache.mockReturnValue(null);
    mockGetReadCacheEntry.mockResolvedValue(null);
    mockSetReadCacheEntry.mockResolvedValue(undefined);
    mockFetchBusinessData.mockResolvedValue(emptyFetchResult());
    mockFetchSingleCollection.mockResolvedValue({});
  });

  // --- refetch: full reload ---

  it('refetch() without collection invalidates cache and re-fetches full payload', async () => {
    const { result } = renderHook(() => useBusinessData('b1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchBusinessData).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refetch();
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockInvalidateBusinessCache).toHaveBeenCalledWith('b1');
    expect(mockFetchBusinessData).toHaveBeenCalledTimes(2);
  });

  it('refetch() is a no-op when businessId is null', () => {
    const { result } = renderHook(() => useBusinessData(null));
    result.current.refetch();
    result.current.refetch('ratings');
    expect(mockInvalidateBusinessCache).not.toHaveBeenCalled();
    expect(mockFetchSingleCollection).not.toHaveBeenCalled();
  });

  it('refetch() is a no-op when user is null', () => {
    mockUser = null;
    const { result } = renderHook(() => useBusinessData('b1'));
    result.current.refetch();
    result.current.refetch('comments');
    expect(mockInvalidateBusinessCache).not.toHaveBeenCalled();
    expect(mockFetchSingleCollection).not.toHaveBeenCalled();
  });

  // --- refetch: partial collection ---

  it('refetch(collectionName) calls fetchSingleCollection and patches cache', async () => {
    mockFetchSingleCollection.mockResolvedValue({ isFavorite: true });

    const { result } = renderHook(() => useBusinessData('b1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.refetch('favorites');
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockFetchSingleCollection).toHaveBeenCalledWith('b1', 'u1', 'favorites');
    expect(mockPatchBusinessCache).toHaveBeenCalledWith('b1', { isFavorite: true });
    expect(result.current.isFavorite).toBe(true);
  });

  it('refetch(collectionName) logs error when fetchSingleCollection rejects', async () => {
    mockFetchSingleCollection.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useBusinessData('b1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.refetch('ratings');
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(mockPatchBusinessCache).not.toHaveBeenCalled();
    expect(result.current.error).toBe(false);
  });

  // --- merge: partial refetch during full load wins ---

  it('keeps partial-refetch favorites when full load completes after it (race fix)', async () => {
    // Regression test for race: refetch('favorites') landed first with isFavorite=true,
    // then the slow full load returns isFavorite=false → merge MUST keep prev.isFavorite.
    let resolveFull!: (v: ReturnType<typeof emptyFetchResult>) => void;
    mockFetchBusinessData.mockImplementationOnce(
      () => new Promise((res) => { resolveFull = res; }),
    );
    mockFetchSingleCollection.mockResolvedValueOnce({ isFavorite: true });

    const { result } = renderHook(() => useBusinessData('b1'));

    await act(async () => {
      result.current.refetch('favorites');
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.isFavorite).toBe(true);

    await act(async () => {
      resolveFull({ ...emptyFetchResult(), isFavorite: false });
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.isFavorite).toBe(true);
  });

  it('merges patched comments (with userCommentLikes) on overlap', async () => {
    let resolveFull!: (v: ReturnType<typeof emptyFetchResult>) => void;
    mockFetchBusinessData.mockImplementationOnce(
      () => new Promise((res) => { resolveFull = res; }),
    );
    mockFetchSingleCollection.mockResolvedValueOnce({
      comments: [{ id: 'patched' } as unknown as Comment],
      userCommentLikes: new Set(['patched']),
    });

    const { result } = renderHook(() => useBusinessData('b1'));

    await act(async () => {
      result.current.refetch('comments');
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.comments).toHaveLength(1);
    expect(result.current.userCommentLikes.has('patched')).toBe(true);

    await act(async () => {
      resolveFull({
        ...emptyFetchResult(),
        comments: [{ id: 'full-load' } as unknown as Comment],
      });
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.comments[0].id).toBe('patched');
    expect(result.current.userCommentLikes.has('patched')).toBe(true);
  });

  it('merges other patched collections (ratings, userTags, etc.)', async () => {
    let resolveFull!: (v: ReturnType<typeof emptyFetchResult>) => void;
    mockFetchBusinessData.mockImplementationOnce(
      () => new Promise((res) => { resolveFull = res; }),
    );

    // Patch sequence: ratings, userTags, customTags, priceLevels, menuPhoto.
    // Use marker fields to distinguish patched vs full-load values; cast through
    // unknown because these types don't all have an `id` field.
    mockFetchSingleCollection
      .mockResolvedValueOnce({ ratings: [{ businessId: 'pr' } as unknown as Rating] })
      .mockResolvedValueOnce({ userTags: [{ businessId: 'put' } as unknown as UserTag] })
      .mockResolvedValueOnce({ customTags: [{ id: 'pct' } as unknown as CustomTag] })
      .mockResolvedValueOnce({ priceLevels: [{ businessId: 'ppl' } as unknown as PriceLevel] })
      .mockResolvedValueOnce({ menuPhoto: { id: 'pmp' } as unknown as MenuPhoto });

    const { result } = renderHook(() => useBusinessData('b1'));

    await act(async () => {
      result.current.refetch('ratings');
      result.current.refetch('userTags');
      result.current.refetch('customTags');
      result.current.refetch('priceLevels');
      result.current.refetch('menuPhotos');
      await new Promise((r) => setTimeout(r, 20));
    });

    // Full load lands with different data → all patched fields kept
    await act(async () => {
      resolveFull({
        ...emptyFetchResult(),
        ratings: [{ businessId: 'full' } as unknown as Rating],
        userTags: [{ businessId: 'full' } as unknown as UserTag],
        customTags: [{ id: 'full' } as unknown as CustomTag],
        priceLevels: [{ businessId: 'full' } as unknown as PriceLevel],
        menuPhoto: { id: 'full' } as unknown as MenuPhoto,
      });
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.ratings[0].businessId).toBe('pr');
    expect(result.current.userTags[0].businessId).toBe('put');
    expect(result.current.customTags[0].id).toBe('pct');
    expect(result.current.priceLevels[0].businessId).toBe('ppl');
    expect(result.current.menuPhoto?.id).toBe('pmp');
  });

  it('replaces full data when no partial refetches occurred during load', async () => {
    mockFetchBusinessData.mockResolvedValue({
      ...emptyFetchResult(),
      isFavorite: true,
      ratings: [{ businessId: 'r1' } as unknown as Rating],
    });

    const { result } = renderHook(() => useBusinessData('b1'));

    await waitFor(() => expect(result.current.isFavorite).toBe(true));
    expect(result.current.ratings).toHaveLength(1);
  });
});
