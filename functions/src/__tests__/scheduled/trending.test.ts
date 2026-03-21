import { describe, it, expect } from 'vitest';
import { computeScores } from '../../scheduled/trending';

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
