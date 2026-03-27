import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- mock: firebase/firestore ----------
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ _name: name, withConverter: () => ({ _name: name }) })),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((...args: unknown[]) => args),
  doc: vi.fn((_db: unknown, _col: string, id: string) => ({ _id: id })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  documentId: vi.fn(() => '__docId__'),
}));

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: {
    FAVORITES: 'favorites',
    RATINGS: 'ratings',
    COMMENTS: 'comments',
    USER_TAGS: 'userTags',
    CUSTOM_TAGS: 'customTags',
    PRICE_LEVELS: 'priceLevels',
    MENU_PHOTOS: 'menuPhotos',
    COMMENT_LIKES: 'commentLikes',
  },
}));
vi.mock('../config/converters', () => ({
  ratingConverter: {},
  commentConverter: {},
  userTagConverter: {},
  customTagConverter: {},
  priceLevelConverter: {},
  menuPhotoConverter: {},
}));

// ---------- mock: auth ----------
let mockUser: { uid: string } | null = { uid: 'u1' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// ---------- mock: analytics ----------
const mockTrackEvent = vi.fn();
vi.mock('../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

// ---------- mock: logger ----------
vi.mock('../utils/logger', () => ({ logger: { error: vi.fn() } }));

// ---------- mock: cache ----------
const mockGetBusinessCache = vi.fn();
const mockSetBusinessCache = vi.fn();
const mockInvalidateBusinessCache = vi.fn();
const mockPatchBusinessCache = vi.fn();
vi.mock('./useBusinessDataCache', () => ({
  getBusinessCache: (...args: unknown[]) => mockGetBusinessCache(...args),
  setBusinessCache: (...args: unknown[]) => mockSetBusinessCache(...args),
  invalidateBusinessCache: (...args: unknown[]) => mockInvalidateBusinessCache(...args),
  patchBusinessCache: (...args: unknown[]) => mockPatchBusinessCache(...args),
}));

import { useBusinessData } from './useBusinessData';
// Analytics event constants available if needed for future phase-specific tests

// ---------- helpers ----------

/** Builds a minimal Firestore query-snapshot mock. */
function snapOf<T>(items: T[]) {
  return {
    docs: items.map((d) => ({ data: () => d, id: (d as Record<string, unknown>).id ?? 'x' })),
    empty: items.length === 0,
  };
}

/** Builds a minimal Firestore doc-snapshot mock (for getDoc). */
function docSnap(exists: boolean) {
  return { exists: () => exists };
}

const now = new Date();

/** Default phase-1 getDocs responses: ratings, userTags, customTags, priceLevels, menuPhotos */
function defaultGetDocsResponses() {
  return [
    // ratings
    snapOf([{ id: 'r1', businessId: 'b1', score: 4, createdAt: now, updatedAt: now }]),
    // userTags
    snapOf([]),
    // customTags
    snapOf([]),
    // priceLevels
    snapOf([]),
    // menuPhotos (empty)
    snapOf([]),
  ];
}

/** Phase-2 getDocs responses: comments, then commentLikes */
function defaultPhase2Responses() {
  return [
    // comments
    snapOf([
      { id: 'c1', businessId: 'b1', flagged: false, createdAt: now, type: 'comment' },
    ]),
    // commentLikes (for fetchUserLikes batch)
    snapOf([]),
  ];
}

function setupDefaultMocks() {
  mockGetBusinessCache.mockReturnValue(null);

  // getDoc is only called for favorites
  mockGetDoc.mockResolvedValue(docSnap(true));

  // getDocs is called for phase-1 (5 calls) then phase-2 (1 comments + 0-N likes batches)
  const phase1 = defaultGetDocsResponses();
  const phase2 = defaultPhase2Responses();
  const allSnaps = [...phase1, ...phase2];
  let callIndex = 0;
  mockGetDocs.mockImplementation(() => {
    const snap = allSnaps[callIndex] ?? snapOf([]);
    callIndex++;
    return Promise.resolve(snap);
  });
}

describe('useBusinessData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'u1' };
    setupDefaultMocks();
  });

  it('returns EMPTY when businessId is null', () => {
    const { result } = renderHook(() => useBusinessData(null));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isLoadingComments).toBe(false);
    expect(result.current.comments).toEqual([]);
  });

  it('returns EMPTY when user is null', () => {
    mockUser = null;
    const { result } = renderHook(() => useBusinessData('b1'));
    expect(result.current.isLoading).toBe(false);
  });

  // --- loading lifecycle ---
  it('sets isLoading and isLoadingComments to false after fetch completes', async () => {
    const { result } = renderHook(() => useBusinessData('b1'));

    // Loading becomes true then false after fetch
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isLoadingComments).toBe(false);
    expect(result.current.error).toBe(false);
  });

  // --- cache hit ---
  it('returns cached data immediately from memory cache', async () => {
    const cached = {
      isFavorite: true,
      ratings: [],
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
    expect(result.current.isLoadingComments).toBe(false);
    // No Firestore calls
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  // --- stale request ---
  it('ignores stale request when businessId changes', async () => {
    // First call hangs forever
    let firstCallGDocs = 0;
    mockGetDocs.mockImplementation(() => {
      firstCallGDocs++;
      if (firstCallGDocs <= 5) {
        return new Promise(() => {});
      }
      return Promise.resolve(snapOf([]));
    });
    mockGetDoc.mockResolvedValue(docSnap(false));

    const { result, rerender } = renderHook(
      ({ bId }: { bId: string | null }) => useBusinessData(bId),
      { initialProps: { bId: 'old_biz' } },
    );
    // Loading may be synchronously false (set in useCallback, not useState init)
    // The important assertion is that it resolves after switch

    // Switch to cached business
    const cached = {
      isFavorite: false,
      ratings: [],
      comments: [],
      userTags: [],
      customTags: [],
      userCommentLikes: new Set<string>(),
      priceLevels: [],
      menuPhoto: null,
      timestamp: Date.now(),
    };
    mockGetBusinessCache.mockReturnValue(cached);

    await act(async () => { rerender({ bId: 'new_biz' }); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  // --- cache is set after full load ---
  it('calls setBusinessCache with combined phase1+phase2 data', async () => {
    const { result } = renderHook(() => useBusinessData('b1'));
    await waitFor(() => expect(result.current.isLoadingComments).toBe(false));

    expect(mockSetBusinessCache).toHaveBeenCalledTimes(1);
    const [key, data] = mockSetBusinessCache.mock.calls[0];
    expect(key).toBe('b1');
    expect(data).toHaveProperty('isFavorite');
    expect(data).toHaveProperty('comments');
    expect(data).toHaveProperty('ratings');
  });

  // --- error handling ---
  it('sets error=true on fetch failure', async () => {
    mockGetDoc.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useBusinessData('b1'));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.isLoadingComments).toBe(false);
  });
});
