import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockHttpsCallable = vi.fn();

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

vi.mock('../config/firebase', () => ({ functions: {} }));

// Mock import.meta.env
vi.stubGlobal('import', {
  meta: { env: { VITE_FIRESTORE_DATABASE_ID: 'test-db' } },
});

describe('adminFeatured service', () => {
  const mockToggleFn = vi.fn();
  const mockGetListsFn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // First call creates toggleFeaturedFn, second creates getPublicListsFn
    mockHttpsCallable
      .mockReturnValueOnce(mockToggleFn)
      .mockReturnValueOnce(mockGetListsFn);
  });

  it('fetchPublicLists calls the callable and maps dates', async () => {
    const rawList = {
      id: 'list-1',
      name: 'My List',
      featured: true,
      ownerId: 'user-1',
      itemCount: 3,
      editorIds: undefined,
    };
    mockGetListsFn.mockResolvedValue({ data: { lists: [rawList] } });

    const { fetchPublicLists } = await import('./adminFeatured');
    const result = await fetchPublicLists();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('list-1');
    expect(result[0].createdAt).toBeInstanceOf(Date);
    expect(result[0].editorIds).toEqual([]);
  });

  it('fetchPublicLists propagates errors', async () => {
    mockGetListsFn.mockRejectedValue(new Error('callable failed'));

    const { fetchPublicLists } = await import('./adminFeatured');
    await expect(fetchPublicLists()).rejects.toThrow('callable failed');
  });

  it('toggleFeaturedList calls callable with correct args', async () => {
    mockToggleFn.mockResolvedValue({ data: { success: true } });

    const { toggleFeaturedList } = await import('./adminFeatured');
    await toggleFeaturedList('list-1', true);

    expect(mockToggleFn).toHaveBeenCalledWith(
      expect.objectContaining({ listId: 'list-1', featured: true }),
    );
  });
});
