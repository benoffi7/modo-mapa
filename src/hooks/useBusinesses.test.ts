import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { FiltersContext } from '../context/FiltersContext';

vi.mock('./usePriceLevelFilter', () => ({
  usePriceLevelFilter: () => new Map(),
}));

import { useBusinesses } from './useBusinesses';

function createWrapper(overrides: { searchQuery?: string; activeFilters?: string[] } = {}) {
  const value = {
    searchQuery: overrides.searchQuery ?? '',
    setSearchQuery: () => {},
    activeFilters: overrides.activeFilters ?? [],
    toggleFilter: () => {},
    activePriceFilter: null,
    setPriceFilter: () => {},
    userLocation: null,
    setUserLocation: () => {},
  };
  return ({ children }: { children: ReactNode }) =>
    createElement(FiltersContext.Provider, { value }, children);
}

describe('useBusinesses', () => {
  describe('search filtering', () => {
    it('returns all businesses when searchQuery is empty', () => {
      const { result } = renderHook(() => useBusinesses(), {
        wrapper: createWrapper(),
      });
      expect(result.current.businesses.length).toBeGreaterThan(0);
      expect(result.current.businesses.length).toBe(result.current.allBusinesses.length);
    });

    it('filters by name (case-insensitive)', () => {
      const { result } = renderHook(() => useBusinesses(), {
        wrapper: createWrapper({ searchQuery: 'tortoni' }),
      });
      expect(result.current.businesses.length).toBeGreaterThan(0);
      expect(result.current.businesses.every((b) => b.name.toLowerCase().includes('tortoni'))).toBe(true);
    });

    it('filters by address', () => {
      const { result } = renderHook(() => useBusinesses(), {
        wrapper: createWrapper({ searchQuery: 'corrientes' }),
      });
      expect(result.current.businesses.length).toBeGreaterThan(0);
      expect(result.current.businesses.every((b) => b.address.toLowerCase().includes('corrientes'))).toBe(true);
    });

    it('filters by category', () => {
      const { result } = renderHook(() => useBusinesses(), {
        wrapper: createWrapper({ searchQuery: 'cafe' }),
      });
      expect(result.current.businesses.length).toBeGreaterThan(0);
      expect(
        result.current.businesses.every(
          (b) =>
            b.name.toLowerCase().includes('cafe') ||
            b.address.toLowerCase().includes('cafe') ||
            b.category.toLowerCase().includes('cafe'),
        ),
      ).toBe(true);
    });

    it('trims whitespace from query', () => {
      const withSpaces = renderHook(() => useBusinesses(), {
        wrapper: createWrapper({ searchQuery: '  tortoni  ' }),
      });
      const without = renderHook(() => useBusinesses(), {
        wrapper: createWrapper({ searchQuery: 'tortoni' }),
      });
      expect(withSpaces.result.current.businesses.length).toBe(
        without.result.current.businesses.length,
      );
    });
  });

  describe('tag filtering', () => {
    it('returns all businesses when activeFilters is empty', () => {
      const { result } = renderHook(() => useBusinesses(), {
        wrapper: createWrapper({ activeFilters: [] }),
      });
      expect(result.current.businesses.length).toBe(result.current.allBusinesses.length);
    });

    it('filters by tag (AND logic)', () => {
      const { result } = renderHook(() => useBusinesses(), {
        wrapper: createWrapper({ activeFilters: ['barato'] }),
      });
      expect(result.current.businesses.length).toBeGreaterThan(0);
      expect(result.current.businesses.every((b) => b.tags.includes('barato'))).toBe(true);
    });

    it('multiple tags require ALL to match', () => {
      const { result } = renderHook(() => useBusinesses(), {
        wrapper: createWrapper({ activeFilters: ['barato', 'buena_atencion'] }),
      });
      expect(
        result.current.businesses.every(
          (b) => b.tags.includes('barato') && b.tags.includes('buena_atencion'),
        ),
      ).toBe(true);
    });
  });

  describe('combined', () => {
    it('search + tags combine', () => {
      const { result } = renderHook(() => useBusinesses(), {
        wrapper: createWrapper({ searchQuery: 'restaurant', activeFilters: ['barato'] }),
      });
      expect(
        result.current.businesses.every(
          (b) =>
            (b.name.toLowerCase().includes('restaurant') ||
              b.address.toLowerCase().includes('restaurant') ||
              b.category.toLowerCase().includes('restaurant')) &&
            b.tags.includes('barato'),
        ),
      ).toBe(true);
    });
  });

  describe('allBusinesses', () => {
    it('always returns the full list regardless of filters', () => {
      const { result } = renderHook(() => useBusinesses(), {
        wrapper: createWrapper({ searchQuery: 'xyznonexistent' }),
      });
      expect(result.current.businesses).toHaveLength(0);
      expect(result.current.allBusinesses.length).toBeGreaterThan(0);
    });
  });
});
