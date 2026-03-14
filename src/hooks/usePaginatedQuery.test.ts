import { renderHook, act, waitFor } from '@testing-library/react';
import { usePaginatedQuery, invalidateQueryCache } from './usePaginatedQuery';

const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  query: vi.fn((...args: unknown[]) => args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  limit: vi.fn((n: number) => ({ type: 'limit', value: n })),
  startAfter: vi.fn((doc: unknown) => ({ type: 'startAfter', doc })),
  orderBy: vi.fn((field: string, dir: string) => ({ type: 'orderBy', field, dir })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ type: 'where', field, op, value })),
}));

function makeDoc(data: Record<string, unknown>) {
  return { data: () => data };
}

function makeSnapshot(docs: ReturnType<typeof makeDoc>[]) {
  return { docs };
}

describe('usePaginatedQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear query cache between tests to avoid interference
    invalidateQueryCache('testCollection', 'user-1');
  });

  it('returns loading state initially', () => {
    mockGetDocs.mockResolvedValue(makeSnapshot([]));
    const mockRef = { path: 'testCollection' } as never;

    const { result } = renderHook(() =>
      usePaginatedQuery(mockRef, 'user-1', 'createdAt', 2),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
  });

  it('loads first page of items', async () => {
    const docs = [makeDoc({ name: 'A' }), makeDoc({ name: 'B' })];
    mockGetDocs.mockResolvedValue(makeSnapshot(docs));
    const mockRef = { path: 'testCollection' } as never;

    const { result } = renderHook(() =>
      usePaginatedQuery(mockRef, 'user-1', 'createdAt', 2),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([{ name: 'A' }, { name: 'B' }]);
    expect(result.current.hasMore).toBe(false);
  });

  it('detects hasMore when more items than pageSize', async () => {
    const docs = [
      makeDoc({ name: 'A' }),
      makeDoc({ name: 'B' }),
      makeDoc({ name: 'C' }),
    ];
    mockGetDocs.mockResolvedValue(makeSnapshot(docs));
    const mockRef = { path: 'testCollection' } as never;

    const { result } = renderHook(() =>
      usePaginatedQuery(mockRef, 'user-1', 'createdAt', 2),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);
  });

  it('loads more items when loadMore is called', async () => {
    const firstPage = [
      makeDoc({ name: 'A' }),
      makeDoc({ name: 'B' }),
      makeDoc({ name: 'extra' }),
    ];
    const secondPage = [makeDoc({ name: 'C' })];
    mockGetDocs
      .mockResolvedValueOnce(makeSnapshot(firstPage))
      .mockResolvedValueOnce(makeSnapshot(secondPage));

    const mockRef = { path: 'testCollection' } as never;

    const { result } = renderHook(() =>
      usePaginatedQuery(mockRef, 'user-1', 'createdAt', 2),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.items).toHaveLength(3);
    expect(result.current.items).toEqual([
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
    ]);
    expect(result.current.hasMore).toBe(false);
  });

  it('resets to first page on reload', async () => {
    const firstLoad = [makeDoc({ name: 'A' })];
    const reloadData = [makeDoc({ name: 'B' })];
    mockGetDocs
      .mockResolvedValueOnce(makeSnapshot(firstLoad))
      .mockResolvedValueOnce(makeSnapshot(reloadData));

    const mockRef = { path: 'testCollection' } as never;

    const { result } = renderHook(() =>
      usePaginatedQuery(mockRef, 'user-1', 'createdAt', 2),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([{ name: 'A' }]);

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.items).toEqual([{ name: 'B' }]);
  });

  it('sets error on failure', async () => {
    mockGetDocs.mockRejectedValue(new Error('Network error'));
    const mockRef = { path: 'testCollection' } as never;

    const { result } = renderHook(() =>
      usePaginatedQuery(mockRef, 'user-1', 'createdAt', 2),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.items).toEqual([]);
  });

  it('skips query when collectionRef is null', async () => {
    const { result } = renderHook(() =>
      usePaginatedQuery(null, 'user-1', 'createdAt', 2),
    );

    // Should stay in loading state since the query never runs
    expect(result.current.isLoading).toBe(true);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('skips query when userId is undefined', async () => {
    const mockRef = { path: 'testCollection' } as never;
    const { result } = renderHook(() =>
      usePaginatedQuery(mockRef, undefined, 'createdAt', 2),
    );

    expect(result.current.isLoading).toBe(true);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('serves first page from cache on second render', async () => {
    const docs = [makeDoc({ name: 'A' }), makeDoc({ name: 'B' })];
    mockGetDocs.mockResolvedValue(makeSnapshot(docs));
    const mockRef = { path: 'testCollection' } as never;

    // First render — fetches from Firestore and populates cache
    const { result, unmount } = renderHook(() =>
      usePaginatedQuery(mockRef, 'user-1', 'createdAt', 2),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    unmount();

    // Second render — should serve from cache without calling getDocs again
    mockGetDocs.mockClear();
    const { result: result2 } = renderHook(() =>
      usePaginatedQuery(mockRef, 'user-1', 'createdAt', 2),
    );

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false);
    });
    expect(result2.current.items).toEqual([{ name: 'A' }, { name: 'B' }]);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('invalidateQueryCache forces fresh fetch', async () => {
    const docs = [makeDoc({ name: 'A' })];
    mockGetDocs.mockResolvedValue(makeSnapshot(docs));
    const mockRef = { path: 'testCollection' } as never;

    // First render — populates cache
    const { result, unmount } = renderHook(() =>
      usePaginatedQuery(mockRef, 'user-1', 'createdAt', 2),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    unmount();

    // Invalidate cache
    invalidateQueryCache('testCollection', 'user-1');

    // Second render — should fetch again
    mockGetDocs.mockClear();
    const freshDocs = [makeDoc({ name: 'B' })];
    mockGetDocs.mockResolvedValue(makeSnapshot(freshDocs));

    const { result: result2 } = renderHook(() =>
      usePaginatedQuery(mockRef, 'user-1', 'createdAt', 2),
    );

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false);
    });
    expect(result2.current.items).toEqual([{ name: 'B' }]);
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });
});
