import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../hooks/useBusinesses', () => ({
  allBusinesses: [
    { id: 'biz_001', name: 'Café Central', category: 'cafe', lat: -34.6, lng: -58.4, address: 'Av 1', tags: [] },
    { id: 'biz_002', name: 'Pizzería Roma', category: 'pizza', lat: -34.61, lng: -58.41, address: 'Av 2', tags: [] },
    { id: 'biz_003', name: 'Bar Nueve', category: 'bar', lat: -34.62, lng: -58.42, address: 'Av 3', tags: [] },
  ],
}));

import {
  getBusinessMap,
  getBusinessById,
  getAllBusinessIdsSet,
  __resetBusinessMap,
} from './businessMap';

describe('businessMap singleton', () => {
  beforeEach(() => {
    __resetBusinessMap();
  });

  describe('getBusinessMap', () => {
    it('returns a Map keyed by business id', () => {
      const map = getBusinessMap();
      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(3);
      expect(map.get('biz_001')?.name).toBe('Café Central');
      expect(map.get('biz_002')?.name).toBe('Pizzería Roma');
      expect(map.get('biz_003')?.name).toBe('Bar Nueve');
    });

    it('returns the same Map reference on successive calls (singleton)', () => {
      const first = getBusinessMap();
      const second = getBusinessMap();
      const third = getBusinessMap();
      expect(first).toBe(second);
      expect(second).toBe(third);
    });

    it('rebuilds the Map after __resetBusinessMap', () => {
      const first = getBusinessMap();
      __resetBusinessMap();
      const second = getBusinessMap();
      expect(first).not.toBe(second);
      expect(second.size).toBe(3);
    });
  });

  describe('getBusinessById', () => {
    it('returns the business for an existing id', () => {
      const biz = getBusinessById('biz_001');
      expect(biz?.name).toBe('Café Central');
      expect(biz?.category).toBe('cafe');
    });

    it('returns undefined for a missing id', () => {
      expect(getBusinessById('invalid')).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(getBusinessById('')).toBeUndefined();
    });

    it('uses the shared singleton (no rebuild per call)', () => {
      getBusinessById('biz_001');
      const mapAfterFirst = getBusinessMap();
      getBusinessById('biz_002');
      const mapAfterSecond = getBusinessMap();
      expect(mapAfterFirst).toBe(mapAfterSecond);
    });
  });

  describe('getAllBusinessIdsSet', () => {
    it('returns a Set containing every business id', () => {
      const ids = getAllBusinessIdsSet();
      expect(ids).toBeInstanceOf(Set);
      expect(ids.size).toBe(3);
      expect(ids.has('biz_001')).toBe(true);
      expect(ids.has('biz_002')).toBe(true);
      expect(ids.has('biz_003')).toBe(true);
    });

    it('returns false for ids that are not in the dataset', () => {
      const ids = getAllBusinessIdsSet();
      expect(ids.has('biz_999')).toBe(false);
      expect(ids.has('')).toBe(false);
    });

    it('returns the same Set reference on successive calls (singleton)', () => {
      const first = getAllBusinessIdsSet();
      const second = getAllBusinessIdsSet();
      const third = getAllBusinessIdsSet();
      expect(first).toBe(second);
      expect(second).toBe(third);
    });

    it('rebuilds the Set after __resetBusinessMap', () => {
      const first = getAllBusinessIdsSet();
      __resetBusinessMap();
      const second = getAllBusinessIdsSet();
      expect(first).not.toBe(second);
      expect(second.size).toBe(3);
    });
  });

  describe('coordinated reset (Map + Set)', () => {
    it('resets both Map and Set singletons in a single invocation', () => {
      const prevMap = getBusinessMap();
      const prevSet = getAllBusinessIdsSet();

      __resetBusinessMap();

      const newMap = getBusinessMap();
      const newSet = getAllBusinessIdsSet();

      // Both singletons must be fresh instances after the coordinated reset.
      expect(newMap).not.toBe(prevMap);
      expect(newSet).not.toBe(prevSet);

      // Content invariants preserved.
      expect(newMap.size).toBe(3);
      expect(newSet.size).toBe(3);
      expect(newMap.get('biz_001')?.name).toBe('Café Central');
      expect(newSet.has('biz_001')).toBe(true);
    });
  });
});
