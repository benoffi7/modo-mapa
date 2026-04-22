import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useListFilters } from './useListFilters';
import type { Business, BusinessCategory } from '../types';

function makeBusiness(id: string, name: string, lat: number, lng: number, category: BusinessCategory = 'restaurant'): Business {
  return { id, name, lat, lng, category, address: '', tags: [] } as unknown as Business;
}

function makeItem(id: string, name: string, lat: number, lng: number) {
  return {
    business: makeBusiness(id, name, lat, lng),
    createdAt: new Date(),
  };
}

describe('useListFilters', () => {
  describe('distance-asc sort', () => {
    const items = [
      makeItem('far', 'Far Place', -34.7, -58.5),
      makeItem('close', 'Close Place', -34.56, -58.45),
      makeItem('mid', 'Mid Place', -34.6, -58.47),
    ];
    const officeLocation = { lat: -34.5591511, lng: -58.4473681 };

    it('sorts items by distance when userLocation is provided', () => {
      const { result } = renderHook(() =>
        useListFilters(items, { userLocation: officeLocation }),
      );

      act(() => {
        result.current.setSortBy('distance-asc');
      });

      const names = result.current.filtered.map((i) => i.business!.name);
      expect(names).toEqual(['Close Place', 'Mid Place', 'Far Place']);
    });

    it('does not crash when userLocation is null', () => {
      const { result } = renderHook(() =>
        useListFilters(items, { userLocation: null }),
      );

      act(() => {
        result.current.setSortBy('distance-asc');
      });

      expect(result.current.filtered).toHaveLength(3);
    });
  });

  describe('existing sorts', () => {
    const items = [
      { business: makeBusiness('a', 'Banana', -34.5, -58.4), createdAt: new Date('2026-01-01') },
      { business: makeBusiness('b', 'Apple', -34.5, -58.4), createdAt: new Date('2026-03-01') },
    ];

    it('sorts by name-asc', () => {
      const { result } = renderHook(() => useListFilters(items));
      act(() => { result.current.setSortBy('name-asc'); });
      expect(result.current.filtered[0].business!.name).toBe('Apple');
    });

    it('sorts by name-desc', () => {
      const { result } = renderHook(() => useListFilters(items));
      act(() => { result.current.setSortBy('name-desc'); });
      expect(result.current.filtered[0].business!.name).toBe('Banana');
    });

    it('sorts by date-desc (default)', () => {
      const { result } = renderHook(() => useListFilters(items));
      // date-desc is default — newer dates first
      expect(result.current.filtered[0].business!.name).toBe('Apple'); // 2026-03-01
    });

    it('sorts by date-asc', () => {
      const { result } = renderHook(() => useListFilters(items));
      act(() => { result.current.setSortBy('date-asc'); });
      expect(result.current.filtered[0].business!.name).toBe('Banana'); // 2026-01-01
    });

    it('sorts by score-desc', () => {
      const itemsWithScore = [
        { business: makeBusiness('a', 'Low', -34.5, -58.4), score: 2, createdAt: new Date() },
        { business: makeBusiness('b', 'High', -34.5, -58.4), score: 5, createdAt: new Date() },
      ];
      const { result } = renderHook(() => useListFilters(itemsWithScore));
      act(() => { result.current.setSortBy('score-desc'); });
      expect(result.current.filtered[0].business!.name).toBe('High');
    });

    it('sorts by score-asc', () => {
      const itemsWithScore = [
        { business: makeBusiness('a', 'High', -34.5, -58.4), score: 5, createdAt: new Date() },
        { business: makeBusiness('b', 'Low', -34.5, -58.4), score: 1, createdAt: new Date() },
      ];
      const { result } = renderHook(() => useListFilters(itemsWithScore));
      act(() => { result.current.setSortBy('score-asc'); });
      expect(result.current.filtered[0].business!.name).toBe('Low');
    });

    it('filters by search query', () => {
      const { result } = renderHook(() => useListFilters(items));
      act(() => { result.current.setSearchQuery('ban'); });
      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].business!.name).toBe('Banana');
    });

    it('filters by category', () => {
      const mixed = [
        { business: makeBusiness('r', 'Rest', -34.5, -58.4, 'restaurant'), createdAt: new Date() },
        { business: makeBusiness('c', 'Cafe', -34.5, -58.4, 'cafe'), createdAt: new Date() },
      ];
      const { result } = renderHook(() => useListFilters(mixed));
      act(() => { result.current.setCategoryFilter('cafe'); });
      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].business!.name).toBe('Cafe');
    });

    it('filters by minScore when enableScoreFilter is true', () => {
      const itemsWithScore = [
        { business: makeBusiness('a', 'Low', -34.5, -58.4), score: 2, createdAt: new Date() },
        { business: makeBusiness('b', 'High', -34.5, -58.4), score: 4, createdAt: new Date() },
      ];
      const { result } = renderHook(() =>
        useListFilters(itemsWithScore, { enableScoreFilter: true }),
      );
      act(() => { result.current.setMinScore(3); });
      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].business!.name).toBe('High');
    });

    it('score filter is skipped when enableScoreFilter is false', () => {
      const itemsWithScore = [
        { business: makeBusiness('a', 'Low', -34.5, -58.4), score: 1, createdAt: new Date() },
        { business: makeBusiness('b', 'High', -34.5, -58.4), score: 5, createdAt: new Date() },
      ];
      const { result } = renderHook(() =>
        useListFilters(itemsWithScore, { enableScoreFilter: false }),
      );
      act(() => { result.current.setMinScore(3); });
      // Score filter not applied — both items remain
      expect(result.current.filtered).toHaveLength(2);
    });

    it('excludes items with null business', () => {
      const withNull = [
        { business: null, createdAt: new Date() },
        { business: makeBusiness('a', 'Valid', -34.5, -58.4), createdAt: new Date() },
      ];
      const { result } = renderHook(() => useListFilters(withNull as Parameters<typeof useListFilters>[0]));
      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.total).toBe(1);
    });

    it('falls back to createdAt when updatedAt is absent for date sort', () => {
      const a = { business: makeBusiness('a', 'Old', -34.5, -58.4), createdAt: new Date('2026-01-01') };
      const b = { business: makeBusiness('b', 'New', -34.5, -58.4), createdAt: new Date('2026-06-01') };
      const { result } = renderHook(() => useListFilters([a, b]));
      // default is date-desc, using createdAt as fallback
      expect(result.current.filtered[0].business!.name).toBe('New');
    });
  });
});
