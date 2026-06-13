import { describe, it, expect, vi } from 'vitest';

const {
  handlerHolder,
  mockGetDb,
  mockTrackFunctionTiming,
} = vi.hoisted(() => ({
  handlerHolder: { fn: null as (() => Promise<void>) | null },
  mockGetDb: vi.fn(),
  mockTrackFunctionTiming: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (_opts: unknown, handler: () => Promise<void>) => {
    handlerHolder.fn = handler;
    return handler;
  },
}));

vi.mock('../../helpers/env', () => ({
  get getDb() { return mockGetDb; },
}));

vi.mock('../../utils/perfTracker', () => ({
  trackFunctionTiming: (name: string, startMs: number) => mockTrackFunctionTiming(name, startMs),
}));

import { buildFeaturedLists } from '../../scheduled/featuredLists';

describe('buildFeaturedLists', () => {
  it('returns 3 lists', () => {
    const lists = buildFeaturedLists({});
    expect(lists).toHaveLength(3);
    expect(lists.map((l) => l.key)).toEqual([
      'featured_top_rated',
      'featured_most_commented',
      'featured_most_favorited',
    ]);
  });

  it('returns empty items when no aggregates', () => {
    const lists = buildFeaturedLists({});
    expect(lists.every((l) => l.items.length === 0)).toBe(true);
  });

  it('top rated filters out businesses with < 3 ratings', () => {
    const agg = {
      businessRatingCount: { biz1: 5, biz2: 2, biz3: 10 },
      businessRatingSum: { biz1: 20, biz2: 10, biz3: 40 },
    };
    const lists = buildFeaturedLists(agg);
    const topRated = lists.find((l) => l.key === 'featured_top_rated')!;
    expect(topRated.items).toContain('biz1');
    expect(topRated.items).toContain('biz3');
    expect(topRated.items).not.toContain('biz2'); // only 2 ratings
  });

  it('top rated sorts by average descending', () => {
    const agg = {
      businessRatingCount: { biz1: 5, biz3: 10, biz4: 3 },
      businessRatingSum: { biz1: 20, biz3: 40, biz4: 15 }, // avg: 4.0, 4.0, 5.0
    };
    const lists = buildFeaturedLists(agg);
    const topRated = lists.find((l) => l.key === 'featured_top_rated')!;
    expect(topRated.items[0]).toBe('biz4'); // avg 5.0
  });

  it('limits to top 10', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 20; i++) counts[`biz${i}`] = 20 - i;
    const agg = { businessComments: counts };
    const lists = buildFeaturedLists(agg);
    const topCommented = lists.find((l) => l.key === 'featured_most_commented')!;
    expect(topCommented.items).toHaveLength(10);
    expect(topCommented.items[0]).toBe('biz0'); // highest count
  });

  it('most favorited sorts correctly', () => {
    const agg = {
      businessFavorites: { biz1: 10, biz2: 50, biz3: 30 },
    };
    const lists = buildFeaturedLists(agg);
    const topFav = lists.find((l) => l.key === 'featured_most_favorited')!;
    expect(topFav.items).toEqual(['biz2', 'biz3', 'biz1']);
  });
});

describe('generateFeaturedLists handler', () => {
  it('tracks function timing with generateFeaturedLists label', async () => {
    // Build minimal db mock: config/aggregates returns empty data,
    // sharedLists set + listItems collection + batch all chain.
    const aggGet = vi.fn().mockResolvedValue({ data: () => ({}) });
    const setMerge = vi.fn().mockResolvedValue(undefined);
    const itemsGet = vi.fn().mockResolvedValue({ docs: [] });
    const batchSet = vi.fn();
    const batchDelete = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);
    const batch = vi.fn().mockReturnValue({
      delete: batchDelete,
      set: batchSet,
      commit: batchCommit,
    });
    // doc() returns helpers depending on path; we keep it generic
    const docFn = vi.fn().mockReturnValue({
      get: aggGet,
      set: setMerge,
    });
    const collectionFn = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ get: itemsGet }),
    });
    const dbMock = {
      doc: docFn,
      collection: collectionFn,
      batch,
    };
    mockGetDb.mockReturnValue(dbMock);
    mockTrackFunctionTiming.mockClear();

    await handlerHolder.fn!();

    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('generateFeaturedLists', expect.any(Number));
  });
});
