import { describe, it, expect, vi } from 'vitest';

vi.mock('./useBusinesses', () => ({
  allBusinesses: [
    { id: 'biz_001', name: 'Cafe 1', address: 'Calle 1, CABA', lat: -34.6, lng: -58.38, tags: [], phone: null, category: 'cafe' },
    { id: 'biz_002', name: 'Cafe 2', address: 'Calle 2, CABA', lat: -34.61, lng: -58.39, tags: [], phone: null, category: 'cafe' },
    { id: 'biz_003', name: 'Bar Rosario', address: 'Calle 3, Rosario', lat: -32.94, lng: -60.63, tags: [], phone: null, category: 'bar' },
  ],
}));

import { calcLocalGuide, extractLocality, buildBusinessLocalityMap } from './useLocalGuideBadge';
import type { Rating } from '../types';

function makeRating(businessId: string, score = 4, userId = 'u1'): Rating {
  return { userId, businessId, score, createdAt: new Date(), updatedAt: new Date() };
}

describe('extractLocality', () => {
  it('returns last segment trimmed and lowercased', () => {
    expect(extractLocality('Calle 1, CABA')).toBe('caba');
  });

  it('handles single-segment address', () => {
    expect(extractLocality('CABA')).toBe('caba');
  });

  it('handles empty address', () => {
    expect(extractLocality('')).toBe('');
  });
});

describe('buildBusinessLocalityMap', () => {
  it('returns a map with one entry per business', () => {
    const map = buildBusinessLocalityMap();
    expect(map.size).toBe(3);
    expect(map.get('biz_001')).toBe('caba');
    expect(map.get('biz_003')).toBe('rosario');
  });
});

describe('calcLocalGuide', () => {
  it('returns 0 current with no ratings', () => {
    const result = calcLocalGuide([], 'CABA');
    expect(result.current).toBe(0);
    expect(result.target).toBe(50);
  });

  it('returns 0 current when userLocality is undefined', () => {
    const ratings = Array.from({ length: 10 }, () => makeRating('biz_001'));
    const result = calcLocalGuide(ratings, undefined);
    expect(result.current).toBe(0);
  });

  it('counts only ratings in the matching locality', () => {
    const ratings = [
      makeRating('biz_001'), // CABA
      makeRating('biz_002'), // CABA
      makeRating('biz_003'), // Rosario
    ];
    const result = calcLocalGuide(ratings, 'CABA');
    expect(result.current).toBe(2);
  });

  it('handles ratings for businesses not in the static data', () => {
    const ratings = [makeRating('biz_unknown')];
    const result = calcLocalGuide(ratings, 'CABA');
    expect(result.current).toBe(0);
  });

  it('counts exact threshold (50)', () => {
    const ratings = Array.from({ length: 50 }, () => makeRating('biz_001'));
    const result = calcLocalGuide(ratings, 'CABA');
    expect(result.current).toBe(50);
    expect(result.current).toBeGreaterThanOrEqual(result.target);
  });

  it('is case insensitive for locality matching', () => {
    const ratings = [makeRating('biz_001')];
    const result = calcLocalGuide(ratings, '  cAbA  ');
    expect(result.current).toBe(1);
  });
});
