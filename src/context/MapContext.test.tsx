import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MapProvider, useSelection, useFilters, useMapContext } from './MapContext';
import type { Business } from '../types';

function wrapper({ children }: { children: ReactNode }) {
  return <MapProvider>{children}</MapProvider>;
}

function makeBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: overrides.id ?? 'biz_1',
    name: overrides.name ?? 'Test Business',
    address: overrides.address ?? 'Av. Test 123',
    category: overrides.category ?? 'restaurant',
    lat: -34.6,
    lng: -58.3,
    tags: overrides.tags ?? [],
    phone: overrides.phone ?? null,
  };
}

describe('MapContext', () => {
  describe('SelectionContext defaults', () => {
    it('has null selectedBusiness by default', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });
      expect(result.current.selectedBusiness).toBeNull();
    });
  });

  describe('FiltersContext defaults', () => {
    it('has empty searchQuery by default', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });
      expect(result.current.searchQuery).toBe('');
    });

    it('has empty activeFilters by default', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });
      expect(result.current.activeFilters).toEqual([]);
    });

    it('has null userLocation by default', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });
      expect(result.current.userLocation).toBeNull();
    });
  });

  describe('setSelectedBusiness', () => {
    it('updates selectedBusiness', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });
      const business = makeBusiness({ name: 'La Parrilla' });

      act(() => result.current.setSelectedBusiness(business));
      expect(result.current.selectedBusiness).toEqual(business);
    });

    it('clears selectedBusiness with null', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });
      const business = makeBusiness();

      act(() => result.current.setSelectedBusiness(business));
      act(() => result.current.setSelectedBusiness(null));
      expect(result.current.selectedBusiness).toBeNull();
    });
  });

  describe('setSearchQuery', () => {
    it('updates searchQuery', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      act(() => result.current.setSearchQuery('café'));
      expect(result.current.searchQuery).toBe('café');
    });
  });

  describe('toggleFilter', () => {
    it('adds a filter when not present', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      act(() => result.current.toggleFilter('barato'));
      expect(result.current.activeFilters).toEqual(['barato']);
    });

    it('removes a filter when already present', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      act(() => result.current.toggleFilter('barato'));
      act(() => result.current.toggleFilter('barato'));
      expect(result.current.activeFilters).toEqual([]);
    });

    it('handles multiple filters', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      act(() => result.current.toggleFilter('barato'));
      act(() => result.current.toggleFilter('delivery'));
      expect(result.current.activeFilters).toEqual(['barato', 'delivery']);

      act(() => result.current.toggleFilter('barato'));
      expect(result.current.activeFilters).toEqual(['delivery']);
    });
  });

  describe('setUserLocation', () => {
    it('updates userLocation', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });
      const location = { lat: -34.6037, lng: -58.3816 };

      act(() => result.current.setUserLocation(location));
      expect(result.current.userLocation).toEqual(location);
    });

    it('clears userLocation with null', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      act(() => result.current.setUserLocation({ lat: -34.6, lng: -58.3 }));
      act(() => result.current.setUserLocation(null));
      expect(result.current.userLocation).toBeNull();
    });
  });

  describe('setPriceFilter', () => {
    it('has null activePriceFilter by default', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });
      expect(result.current.activePriceFilter).toBeNull();
    });

    it('sets price level when different from current', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      act(() => result.current.setPriceFilter(2));
      expect(result.current.activePriceFilter).toBe(2);
    });

    it('toggles price level to null when same as current', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      act(() => result.current.setPriceFilter(2));
      expect(result.current.activePriceFilter).toBe(2);

      act(() => result.current.setPriceFilter(2));
      expect(result.current.activePriceFilter).toBeNull();
    });

    it('switches to a different price level', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      act(() => result.current.setPriceFilter(1));
      expect(result.current.activePriceFilter).toBe(1);

      act(() => result.current.setPriceFilter(3));
      expect(result.current.activePriceFilter).toBe(3);
    });

    it('handles explicit null to clear price filter', () => {
      const { result } = renderHook(() => useFilters(), { wrapper });

      act(() => result.current.setPriceFilter(2));
      act(() => result.current.setPriceFilter(null));
      expect(result.current.activePriceFilter).toBeNull();
    });
  });

  describe('useMapContext (deprecated)', () => {
    it('returns merged selection and filters context', () => {
      const { result } = renderHook(() => useMapContext(), { wrapper });

      expect(result.current).toHaveProperty('selectedBusiness');
      expect(result.current).toHaveProperty('setSelectedBusiness');
      expect(result.current).toHaveProperty('searchQuery');
      expect(result.current).toHaveProperty('setSearchQuery');
      expect(result.current).toHaveProperty('activeFilters');
      expect(result.current).toHaveProperty('toggleFilter');
      expect(result.current).toHaveProperty('activePriceFilter');
      expect(result.current).toHaveProperty('setPriceFilter');
      expect(result.current).toHaveProperty('userLocation');
      expect(result.current).toHaveProperty('setUserLocation');
    });

    it('selection updates are reflected in useMapContext', () => {
      const { result } = renderHook(() => useMapContext(), { wrapper });
      const business = makeBusiness({ name: 'Merged Test' });

      act(() => result.current.setSelectedBusiness(business));
      expect(result.current.selectedBusiness).toEqual(business);
    });

    it('filter updates are reflected in useMapContext', () => {
      const { result } = renderHook(() => useMapContext(), { wrapper });

      act(() => result.current.setSearchQuery('pizza'));
      expect(result.current.searchQuery).toBe('pizza');

      act(() => result.current.toggleFilter('vegano'));
      expect(result.current.activeFilters).toEqual(['vegano']);

      act(() => result.current.setPriceFilter(1));
      expect(result.current.activePriceFilter).toBe(1);
    });
  });

  describe('context isolation', () => {
    it('selection changes do not affect filters', () => {
      const { result: selection } = renderHook(() => useSelection(), { wrapper });
      const { result: filters } = renderHook(() => useFilters(), { wrapper });
      const business = makeBusiness();

      const filtersBefore = { ...filters.current };
      act(() => selection.current.setSelectedBusiness(business));
      expect(filters.current.searchQuery).toBe(filtersBefore.searchQuery);
      expect(filters.current.activeFilters).toEqual(filtersBefore.activeFilters);
    });
  });
});
