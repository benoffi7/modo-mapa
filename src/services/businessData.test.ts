import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMeasureAsync = vi.fn((_name: string, fn: () => Promise<unknown>) => fn());
const mockMeasuredGetDocs = vi.fn();
const mockMeasuredGetDoc = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('../utils/perfMetrics', () => ({
  measureAsync: (name: string, fn: () => Promise<unknown>) => mockMeasureAsync(name, fn),
  measuredGetDocs: (name: string, q: unknown) => mockMeasuredGetDocs(name, q),
  measuredGetDoc: (name: string, ref: unknown) => mockMeasuredGetDoc(name, ref),
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

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  query: vi.fn(() => 'query-ref'),
  where: vi.fn(),
  doc: vi.fn((_db: unknown, col: string, id: string) => ({ __doc: `${col}/${id}` })),
  documentId: vi.fn().mockReturnValue('__name__'),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

function emptyQuerySnap() {
  return { docs: [], empty: true, size: 0 };
}

function nonExistentDocSnap() {
  return { exists: () => false, data: () => undefined };
}

describe('fetchBusinessData — measureAsync instrumentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMeasuredGetDoc.mockResolvedValue(nonExistentDocSnap());
    mockMeasuredGetDocs.mockResolvedValue(emptyQuerySnap());
  });

  it('calls measuredGetDoc for favorites and measuredGetDocs for 6 parallel reads', async () => {
    const { fetchBusinessData } = await import('./businessData');
    await fetchBusinessData('biz_001', 'user_001');

    const docNames = mockMeasuredGetDoc.mock.calls.map((c) => c[0]);
    const docsNames = mockMeasuredGetDocs.mock.calls.map((c) => c[0]);

    expect(docNames).toContain('businessData_favorite');
    expect(docsNames).toContain('businessData_ratings');
    expect(docsNames).toContain('businessData_comments');
    expect(docsNames).toContain('businessData_userTags');
    expect(docsNames).toContain('businessData_customTags');
    expect(docsNames).toContain('businessData_priceLevels');
    expect(docsNames).toContain('businessData_menuPhotos');
  });

  it('returns shape with all fields defaulted when backend is empty', async () => {
    const { fetchBusinessData } = await import('./businessData');
    const result = await fetchBusinessData('biz_001', 'user_001');

    expect(result.isFavorite).toBe(false);
    expect(result.ratings).toEqual([]);
    expect(result.comments).toEqual([]);
    expect(result.userTags).toEqual([]);
    expect(result.customTags).toEqual([]);
    expect(result.priceLevels).toEqual([]);
    expect(result.menuPhoto).toBeNull();
    expect(result.userCommentLikes.size).toBe(0);
  });
});

describe('fetchSingleCollection — measureAsync instrumentation per case', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMeasuredGetDoc.mockResolvedValue(nonExistentDocSnap());
    mockMeasuredGetDocs.mockResolvedValue(emptyQuerySnap());
  });

  it('favorites case uses businessData_favorite', async () => {
    const { fetchSingleCollection } = await import('./businessData');
    await fetchSingleCollection('biz_001', 'user_001', 'favorites');
    expect(mockMeasuredGetDoc.mock.calls.map((c) => c[0])).toContain('businessData_favorite');
  });

  it.each([
    ['ratings', 'businessData_ratings'],
    ['userTags', 'businessData_userTags'],
    ['customTags', 'businessData_customTags'],
    ['priceLevels', 'businessData_priceLevels'],
    ['menuPhotos', 'businessData_menuPhotos'],
  ] as const)('%s case uses measuredGetDocs with name %s', async (col, expected) => {
    const { fetchSingleCollection } = await import('./businessData');
    await fetchSingleCollection('biz_001', 'user_001', col);
    expect(mockMeasuredGetDocs.mock.calls.map((c) => c[0])).toContain(expected);
  });

  it('comments case uses businessData_comments and fires fetchUserLikes if ids present', async () => {
    // Return a comment doc so fetchUserLikes has ids to look up
    mockMeasuredGetDocs.mockResolvedValueOnce({
      docs: [{ data: () => ({ id: 'c1', flagged: false, createdAt: new Date() }) }],
      empty: false,
      size: 1,
    });
    mockGetDocs.mockResolvedValue(emptyQuerySnap());
    const { fetchSingleCollection } = await import('./businessData');
    await fetchSingleCollection('biz_001', 'user_001', 'comments');
    expect(mockMeasuredGetDocs.mock.calls.map((c) => c[0])).toContain('businessData_comments');
    // fetchUserLikes uses measureAsync directly (not measuredGetDocs) because
    // it wraps a Promise.all of batches; verify that too.
    expect(mockMeasureAsync.mock.calls.map((c) => c[0])).toContain('businessData_userLikes');
  });
});

describe('fetchUserLikes — measureAsync instrumentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps Promise.all of batches with measureAsync name businessData_userLikes', async () => {
    mockGetDocs.mockResolvedValue(emptyQuerySnap());
    const { fetchUserLikes } = await import('./businessData');
    await fetchUserLikes('user_001', ['c1', 'c2']);
    expect(mockMeasureAsync.mock.calls.map((c) => c[0])).toContain('businessData_userLikes');
  });

  it('short-circuits and does not call measureAsync when commentIds is empty', async () => {
    const { fetchUserLikes } = await import('./businessData');
    const result = await fetchUserLikes('user_001', []);
    expect(result.size).toBe(0);
    expect(mockMeasureAsync).not.toHaveBeenCalled();
  });

  it('returns a Set of comment ids that have likes', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'user_001__c1' },
        { id: 'user_001__c3' },
      ],
      empty: false,
      size: 2,
    });
    const { fetchUserLikes } = await import('./businessData');
    const result = await fetchUserLikes('user_001', ['c1', 'c2', 'c3']);
    expect(result.has('c1')).toBe(true);
    expect(result.has('c3')).toBe(true);
    expect(result.has('c2')).toBe(false);
  });

  it('splits 35 ids into 2 batches (30 + 5)', async () => {
    mockGetDocs.mockResolvedValue(emptyQuerySnap());
    const ids = Array.from({ length: 35 }, (_, i) => `comment${i}`);
    const { fetchUserLikes } = await import('./businessData');
    await fetchUserLikes('user_001', ids);
    // measureAsync wraps one Promise.all with 2 batch getDocs calls
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });
});

describe('fetchBusinessData — branch coverage for isFavorite and menuPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMeasuredGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    mockMeasuredGetDocs.mockResolvedValue(emptyQuerySnap());
  });

  it('isFavorite is true when favSnap.exists() returns true', async () => {
    mockMeasuredGetDoc.mockResolvedValue({ exists: () => true, data: () => undefined });
    const { fetchBusinessData } = await import('./businessData');
    const result = await fetchBusinessData('biz_001', 'user_001');
    expect(result.isFavorite).toBe(true);
  });

  it('menuPhoto is non-null when menuPhotoSnap is non-empty', async () => {
    const fakePhoto = { id: 'photo1', url: 'http://example.com/photo.jpg' };
    mockMeasuredGetDocs.mockImplementation(async (name: string) => {
      if (name === 'businessData_menuPhotos') {
        return { docs: [{ data: () => fakePhoto }], empty: false, size: 1 };
      }
      return emptyQuerySnap();
    });
    const { fetchBusinessData } = await import('./businessData');
    const result = await fetchBusinessData('biz_001', 'user_001');
    expect(result.menuPhoto).toEqual(fakePhoto);
  });

  it('filters flagged comments and sorts by createdAt desc', async () => {
    const older = new Date('2024-01-01');
    const newer = new Date('2024-06-01');
    mockMeasuredGetDocs.mockImplementation(async (name: string) => {
      if (name === 'businessData_comments') {
        return {
          docs: [
            { data: () => ({ id: 'c1', flagged: false, createdAt: older }) },
            { data: () => ({ id: 'c2', flagged: true, createdAt: newer }) },
            { data: () => ({ id: 'c3', flagged: false, createdAt: newer }) },
          ],
          empty: false,
          size: 3,
        };
      }
      return emptyQuerySnap();
    });
    mockGetDocs.mockResolvedValue(emptyQuerySnap());

    const { fetchBusinessData } = await import('./businessData');
    const result = await fetchBusinessData('biz_001', 'user_001');
    // c2 (flagged) removed, c3 (newer) before c1 (older)
    expect(result.comments.map((c) => c.id)).toEqual(['c3', 'c1']);
  });
});

describe('fetchSingleCollection — menuPhoto empty vs non-empty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMeasuredGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    mockMeasuredGetDocs.mockResolvedValue(emptyQuerySnap());
  });

  it('menuPhotos returns null when snap is empty', async () => {
    mockMeasuredGetDocs.mockResolvedValue(emptyQuerySnap());
    const { fetchSingleCollection } = await import('./businessData');
    const result = await fetchSingleCollection('biz_001', 'user_001', 'menuPhotos');
    expect(result).toEqual({ menuPhoto: null });
  });

  it('menuPhotos returns first item when snap is non-empty', async () => {
    const photo = { id: 'p1', url: 'http://img.com/p.jpg' };
    mockMeasuredGetDocs.mockResolvedValue({
      docs: [{ data: () => photo }],
      empty: false,
      size: 1,
    });
    const { fetchSingleCollection } = await import('./businessData');
    const result = await fetchSingleCollection('biz_001', 'user_001', 'menuPhotos');
    expect(result).toEqual({ menuPhoto: photo });
  });

  it('favorites returns isFavorite: true when doc exists', async () => {
    mockMeasuredGetDoc.mockResolvedValue({ exists: () => true, data: () => undefined });
    const { fetchSingleCollection } = await import('./businessData');
    const result = await fetchSingleCollection('biz_001', 'user_001', 'favorites');
    expect(result).toEqual({ isFavorite: true });
  });
});
