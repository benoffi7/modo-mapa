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
  });
});
