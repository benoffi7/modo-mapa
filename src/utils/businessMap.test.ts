import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../hooks/useBusinesses', () => ({
  allBusinesses: [
    { id: 'biz_001', name: 'Café Central', category: 'cafe', lat: -34.6, lng: -58.4, address: 'Av 1', tags: [] },
    { id: 'biz_002', name: 'Pizzería Roma', category: 'pizza', lat: -34.61, lng: -58.41, address: 'Av 2', tags: [] },
    { id: 'biz_003', name: 'Bar Nueve', category: 'bar', lat: -34.62, lng: -58.42, address: 'Av 3', tags: [] },
  ],
}));

import { getBusinessMap, getBusinessById, __resetBusinessMap } from './businessMap';

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
});
