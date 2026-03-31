import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { computeScores, countByBusiness, getBusinessNames } from '../../scheduled/trending';

// --- Mock for computeTrendingBusinesses handler test ---

const { handlerHolder, mockGetDb, mockSet, mockDocRef } = vi.hoisted(() => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockDocRef = vi.fn().mockReturnValue({ set: mockSet });
  return {
    handlerHolder: { fn: null as (() => Promise<void>) | null },
    mockGetDb: vi.fn(),
    mockSet,
    mockDocRef,
  };
});

function createFullMockDb(collectionDocs: Record<string, Array<{ businessId?: string }>>, businessDocs: Array<{ id: string; name?: string; category?: string }> = []) {
  const collection = vi.fn().mockImplementation((name: string) => {
    if (name === 'businesses') {
      const bGet = vi.fn().mockResolvedValue({
        docs: businessDocs.map((b) => ({ id: b.id, data: () => ({ name: b.name, category: b.category }) })),
      });
      const bSelect = vi.fn().mockReturnValue({ get: bGet });
      const bWhere = vi.fn().mockReturnValue({ select: bSelect });
      return { where: bWhere };
    }
    const docs = (collectionDocs[name] ?? []).map((d) => ({ data: () => d }));
    const cGet = vi.fn().mockResolvedValue({ docs });
    const cSelect = vi.fn().mockReturnValue({ get: cGet });
    const cWhere = vi.fn().mockReturnValue({ select: cSelect });
    return { where: cWhere };
  });
  return { collection, doc: mockDocRef } as unknown as FirebaseFirestore.Firestore;
}

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (_opts: unknown, handler: () => Promise<void>) => {
    handlerHolder.fn = handler;
    return handler;
  },
}));

vi.mock('../../helpers/env', () => ({
  get getDb() { return mockGetDb; },
}));

// --- Firestore mock helpers ---

function mockDoc(data: Record<string, unknown>, id = 'doc1') {
  return { data: () => data, id };
}

function mockDb(docs: Array<ReturnType<typeof mockDoc>>) {
  const get = vi.fn().mockResolvedValue({ docs });
  const select = vi.fn().mockReturnValue({ get });
  const where = vi.fn().mockReturnValue({ select, get });
  const collection = vi.fn().mockReturnValue({ where });
  return { collection, where, select, get } as unknown as FirebaseFirestore.Firestore;
}

// --- countByBusiness ---

describe('countByBusiness', () => {
  it('groups counts by businessId', async () => {
    const db = mockDb([
      mockDoc({ businessId: 'biz1' }),
      mockDoc({ businessId: 'biz1' }),
      mockDoc({ businessId: 'biz2' }),
    ]);
    const since = new Date('2026-03-13');

    const result = await countByBusiness(db, 'ratings', since);

    expect(result.get('biz1')).toBe(2);
    expect(result.get('biz2')).toBe(1);
    expect(db.collection).toHaveBeenCalledWith('ratings');
  });

  it('skips docs without businessId', async () => {
    const db = mockDb([
      mockDoc({ businessId: 'biz1' }),
      mockDoc({ businessId: '' }),
      mockDoc({ businessId: null }),
      mockDoc({}),
    ]);

    const result = await countByBusiness(db, 'comments', new Date());

    expect(result.size).toBe(1);
    expect(result.get('biz1')).toBe(1);
  });

  it('returns empty map when no docs', async () => {
    const db = mockDb([]);
    const result = await countByBusiness(db, 'userTags', new Date());
    expect(result.size).toBe(0);
  });

  it('passes correct Timestamp filter', async () => {
    const since = new Date('2026-03-13T00:00:00Z');
    const get = vi.fn().mockResolvedValue({ docs: [] });
    const select = vi.fn().mockReturnValue({ get });
    const where = vi.fn().mockReturnValue({ select });
    const collection = vi.fn().mockReturnValue({ where });
    const db = { collection } as unknown as FirebaseFirestore.Firestore;

    await countByBusiness(db, 'ratings', since);

    expect(where).toHaveBeenCalledWith('createdAt', '>=', Timestamp.fromDate(since));
  });
});

// --- getBusinessNames ---

describe('getBusinessNames', () => {
  it('returns name and category for each business', async () => {
    const db = mockDb([
      mockDoc({ name: 'Cafe A', category: 'cafe' }, 'biz1'),
      mockDoc({ name: 'Bar B', category: 'bar' }, 'biz2'),
    ]);

    const result = await getBusinessNames(db, ['biz1', 'biz2']);

    expect(result.get('biz1')).toEqual({ name: 'Cafe A', category: 'cafe' });
    expect(result.get('biz2')).toEqual({ name: 'Bar B', category: 'bar' });
  });

  it('defaults name to "Sin nombre" and category to empty', async () => {
    const db = mockDb([mockDoc({}, 'biz1')]);

    const result = await getBusinessNames(db, ['biz1']);

    expect(result.get('biz1')).toEqual({ name: 'Sin nombre', category: '' });
  });

  it('chunks requests in batches of 30', async () => {
    const ids = Array.from({ length: 35 }, (_, i) => `biz${i}`);
    const get = vi.fn().mockResolvedValue({ docs: [] });
    const select = vi.fn().mockReturnValue({ get });
    const where = vi.fn().mockReturnValue({ select });
    const collection = vi.fn().mockReturnValue({ where });
    const db = { collection } as unknown as FirebaseFirestore.Firestore;

    await getBusinessNames(db, ids);

    // Should be called twice: 30 + 5
    expect(where).toHaveBeenCalledTimes(2);
  });

  it('returns empty map for empty input', async () => {
    const db = mockDb([]);
    const result = await getBusinessNames(db, []);
    expect(result.size).toBe(0);
  });
});

// --- computeScores (existing tests) ---

describe('computeScores', () => {
  it('calculates weighted score correctly', () => {
    const ratings = new Map([['biz1', 5]]);
    const comments = new Map([['biz1', 3]]);
    const userTags = new Map([['biz1', 2]]);
    const priceLevels = new Map([['biz1', 1]]);
    const listItems = new Map([['biz1', 4]]);

    const result = computeScores(ratings, comments, userTags, priceLevels, listItems);

    expect(result).toHaveLength(1);
    // 5*2 + 3*3 + 2*1 + 1*2 + 4*1 = 10 + 9 + 2 + 2 + 4 = 27
    expect(result[0].score).toBe(27);
    expect(result[0].breakdown).toEqual({
      ratings: 5,
      comments: 3,
      userTags: 2,
      priceLevels: 1,
      listItems: 4,
    });
  });

  it('sorts by score descending', () => {
    const ratings = new Map([['biz1', 1], ['biz2', 10]]);
    const empty = new Map<string, number>();

    const result = computeScores(ratings, empty, empty, empty, empty);

    expect(result[0].businessId).toBe('biz2');
    expect(result[1].businessId).toBe('biz1');
  });

  it('limits to 10 businesses', () => {
    const ratings = new Map<string, number>();
    for (let i = 0; i < 15; i++) {
      ratings.set(`biz${i}`, 15 - i);
    }
    const empty = new Map<string, number>();

    const result = computeScores(ratings, empty, empty, empty, empty);

    expect(result).toHaveLength(10);
    expect(result[0].businessId).toBe('biz0');
    expect(result[9].businessId).toBe('biz9');
  });

  it('excludes businesses with zero score', () => {
    const ratings = new Map([['biz1', 3]]);
    const empty = new Map<string, number>();

    const result = computeScores(ratings, empty, empty, empty, empty);

    expect(result).toHaveLength(1);
    expect(result[0].businessId).toBe('biz1');
  });

  it('merges business IDs across all collections', () => {
    const ratings = new Map([['biz1', 1]]);
    const comments = new Map([['biz2', 1]]);
    const userTags = new Map([['biz3', 1]]);
    const priceLevels = new Map([['biz4', 1]]);
    const listItems = new Map([['biz5', 1]]);

    const result = computeScores(ratings, comments, userTags, priceLevels, listItems);

    expect(result).toHaveLength(5);
    const ids = result.map((r) => r.businessId).sort();
    expect(ids).toEqual(['biz1', 'biz2', 'biz3', 'biz4', 'biz5']);
  });

  it('returns empty array when no activity', () => {
    const empty = new Map<string, number>();
    const result = computeScores(empty, empty, empty, empty, empty);
    expect(result).toHaveLength(0);
  });
});

// --- computeTrendingBusinesses handler ---

describe('computeTrendingBusinesses handler', () => {
  beforeEach(() => {
    mockSet.mockClear();
    mockDocRef.mockClear();
    mockGetDb.mockClear();
  });

  it('computes trending and writes to Firestore', async () => {
    // Handler was captured during static import at top of file
    expect(handlerHolder.fn).not.toBeNull();

    const db = createFullMockDb(
      {
        ratings: [{ businessId: 'biz1' }, { businessId: 'biz1' }, { businessId: 'biz2' }],
        comments: [{ businessId: 'biz1' }],
        userTags: [],
        priceLevels: [],
        listItems: [],
      },
      [
        { id: 'biz1', name: 'Cafe A', category: 'cafe' },
        { id: 'biz2', name: 'Bar B', category: 'bar' },
      ],
    );
    mockGetDb.mockReturnValue(db);

    await handlerHolder.fn!();

    expect(mockDocRef).toHaveBeenCalledWith('trendingBusinesses/current');
    // 2 calls: one for trending data, one for cron heartbeat
    expect(mockSet).toHaveBeenCalledTimes(2);

    const written = mockSet.mock.calls[0][0];
    expect(written.businesses).toHaveLength(2);
    // biz1: 2 ratings*2 + 1 comment*3 = 7, biz2: 1 rating*2 = 2
    expect(written.businesses[0].businessId).toBe('biz1');
    expect(written.businesses[0].score).toBe(7);
    expect(written.businesses[0].name).toBe('Cafe A');
    expect(written.businesses[0].rank).toBe(1);
    expect(written.businesses[1].businessId).toBe('biz2');
    expect(written.businesses[1].rank).toBe(2);
    expect(written.computedAt).toBeInstanceOf(Timestamp);
    expect(written.periodStart).toBeInstanceOf(Timestamp);
    expect(written.periodEnd).toBeInstanceOf(Timestamp);
  });

  it('writes empty businesses when no activity', async () => {

    const db = createFullMockDb({ ratings: [], comments: [], userTags: [], priceLevels: [], listItems: [] });
    mockGetDb.mockReturnValue(db);

    await handlerHolder.fn!();

    const written = mockSet.mock.calls[0][0];
    expect(written.businesses).toHaveLength(0);
  });

  it('falls back to "Sin nombre" for unknown businesses', async () => {

    const db = createFullMockDb(
      { ratings: [{ businessId: 'unknown' }], comments: [], userTags: [], priceLevels: [], listItems: [] },
      [], // no business docs
    );
    mockGetDb.mockReturnValue(db);

    await handlerHolder.fn!();

    const written = mockSet.mock.calls[0][0];
    expect(written.businesses[0].name).toBe('Sin nombre');
    expect(written.businesses[0].category).toBe('');
  });
});
