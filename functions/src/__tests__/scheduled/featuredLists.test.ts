import { describe, it, expect } from 'vitest';
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
