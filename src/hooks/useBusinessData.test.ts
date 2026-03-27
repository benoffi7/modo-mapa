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
import {
  EVT_BUSINESS_SHEET_PHASE1_MS,
  EVT_BUSINESS_SHEET_PHASE2_MS,
  EVT_BUSINESS_SHEET_CACHE_HIT,
} from '../constants/analyticsEvents';

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

  // --- two-phase loading ---
  it('sets isLoading=false after phase 1, isLoadingComments=false after phase 2', async () => {
    // Use deferred promises to control timing
    let resolveP1: (v: unknown) => void = () => {};
    let resolveP2: (v: unknown) => void = () => {};

    const phase1Snaps = defaultGetDocsResponses();
    const phase2Snaps = defaultPhase2Responses();

    // getDoc (favorites) resolves immediately
    mockGetDoc.mockResolvedValue(docSnap(false));

    let callIdx = 0;
    mockGetDocs.mockImplementation(() => {
      const idx = callIdx++;
      if (idx < phase1Snaps.length) {
        // Phase 1 calls — wrap last one in a controlled promise
        if (idx === phase1Snaps.length - 1) {
          return new Promise((r) => { resolveP1 = () => r(phase1Snaps[idx]); });
        }
        return Promise.resolve(phase1Snaps[idx]);
      }
      // Phase 2 calls
      const p2Idx = idx - phase1Snaps.length;
      if (p2Idx === 0) {
        return new Promise((r) => { resolveP2 = () => r(phase2Snaps[0]); });
      }
      return Promise.resolve(phase2Snaps[p2Idx] ?? snapOf([]));
    });

    const { result } = renderHook(() => useBusinessData('b1'));

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isLoadingComments).toBe(true);

    // Resolve phase 1
    await act(async () => { resolveP1(undefined); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Comments still loading
    expect(result.current.isLoadingComments).toBe(true);

    // Resolve phase 2
    await act(async () => { resolveP2(undefined); });
    await waitFor(() => expect(result.current.isLoadingComments).toBe(false));
    expect(result.current.isLoading).toBe(false);
  });

  it('phase 1 data is available before phase 2 completes', async () => {
    let resolveComments: (v: unknown) => void = () => {};

    const phase1Snaps = defaultGetDocsResponses();

    mockGetDoc.mockResolvedValue(docSnap(true)); // favorite exists

    let callIdx = 0;
    mockGetDocs.mockImplementation(() => {
      const idx = callIdx++;
      if (idx < phase1Snaps.length) {
        return Promise.resolve(phase1Snaps[idx]);
      }
      // Phase 2 — comments: hang until resolved
      if (idx === phase1Snaps.length) {
        return new Promise((r) => { resolveComments = () => r(snapOf([])); });
      }
      return Promise.resolve(snapOf([]));
    });

    const { result } = renderHook(() => useBusinessData('b1'));

    // Wait for phase 1 to complete
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Phase-1 data available
    expect(result.current.isFavorite).toBe(true);
    expect(result.current.ratings).toHaveLength(1);
    // Comments still empty (phase 2 in flight)
    expect(result.current.comments).toEqual([]);
    expect(result.current.isLoadingComments).toBe(true);

    // Resolve phase 2
    await act(async () => { resolveComments(undefined); });
    await waitFor(() => expect(result.current.isLoadingComments).toBe(false));
  });

  // --- cache hit ---
  it('returns cached data immediately and fires cache_hit event', async () => {
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
    // Analytics
    expect(mockTrackEvent).toHaveBeenCalledWith(EVT_BUSINESS_SHEET_CACHE_HIT, { business_id: 'b1' });
  });

  // --- stale request ---
  it('ignores stale phase-1 result when businessId changes', async () => {
    // First call hangs forever (phase 1 never resolves for old bId)
    let firstCallGDocs = 0;
    mockGetDocs.mockImplementation(() => {
      firstCallGDocs++;
      if (firstCallGDocs <= 5) {
        // Old request phase 1 — never resolve
        return new Promise(() => {});
      }
      return Promise.resolve(snapOf([]));
    });
    mockGetDoc.mockResolvedValue(docSnap(false));

    const { result, rerender } = renderHook(
      ({ bId }: { bId: string | null }) => useBusinessData(bId),
      { initialProps: { bId: 'old_biz' } },
    );
    expect(result.current.isLoading).toBe(true);

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

    rerender({ bId: 'new_biz' });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isLoadingComments).toBe(false);
  });

  // --- analytics events ---
  it('fires phase1 and phase2 timing events', async () => {
    const { result } = renderHook(() => useBusinessData('b1'));
    await waitFor(() => expect(result.current.isLoadingComments).toBe(false));

    expect(mockTrackEvent).toHaveBeenCalledWith(
      EVT_BUSINESS_SHEET_PHASE1_MS,
      expect.objectContaining({ business_id: 'b1' }),
    );
    expect(mockTrackEvent).toHaveBeenCalledWith(
      EVT_BUSINESS_SHEET_PHASE2_MS,
      expect.objectContaining({ business_id: 'b1' }),
    );
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
