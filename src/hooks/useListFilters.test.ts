import { renderHook, act } from '@testing-library/react';
import { useListFilters } from './useListFilters';
import type { Business, BusinessCategory } from '../types';

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

function makeItem(overrides: {
  name?: string;
  category?: BusinessCategory;
  score?: number;
  createdAt?: Date;
  updatedAt?: Date;
  business?: Business | null;
} = {}) {
  const businessOverrides: Partial<Business> = {};
  if (overrides.name !== undefined) businessOverrides.name = overrides.name;
  if (overrides.category !== undefined) businessOverrides.category = overrides.category;

  const item: {
    business: Business | null;
    score: number;
    createdAt: Date;
    updatedAt?: Date | undefined;
  } = {
    business: overrides.business !== undefined
      ? overrides.business
      : makeBusiness(businessOverrides),
    score: overrides.score ?? 3,
    createdAt: overrides.createdAt ?? new Date('2025-01-01'),
  };
  if (overrides.updatedAt !== undefined) item.updatedAt = overrides.updatedAt;
  return item;
}

describe('useListFilters', () => {
  describe('filtering', () => {
    it('returns all items when no filters are active', () => {
      const items = [makeItem({ name: 'A' }), makeItem({ name: 'B' })];
      const { result } = renderHook(() => useListFilters(items));
      expect(result.current.filtered).toHaveLength(2);
    });

    it('filters out items with business: null', () => {
      const items = [makeItem({ name: 'Valid' }), makeItem({ business: null })];
      const { result } = renderHook(() => useListFilters(items));
      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].business!.name).toBe('Valid');
    });

    it('filters by search query (case-insensitive, partial)', () => {
      const items = [
        makeItem({ name: 'La Parrilla' }),
        makeItem({ name: 'Café Tortoni' }),
        makeItem({ name: 'Parrilla del Sur' }),
      ];
      const { result } = renderHook(() => useListFilters(items));

      act(() => result.current.setSearchQuery('parrilla'));
      expect(result.current.filtered).toHaveLength(2);
    });

    it('trims whitespace from search query', () => {
      const items = [makeItem({ name: 'Café Tortoni' })];
      const { result } = renderHook(() => useListFilters(items));

      act(() => result.current.setSearchQuery('  café  '));
      expect(result.current.filtered).toHaveLength(1);
    });

    it('returns all items when search query is empty/whitespace', () => {
      const items = [makeItem({ name: 'A' }), makeItem({ name: 'B' })];
      const { result } = renderHook(() => useListFilters(items));

      act(() => result.current.setSearchQuery('   '));
      expect(result.current.filtered).toHaveLength(2);
    });

    it('filters by category', () => {
      const items = [
        makeItem({ name: 'Rest', category: 'restaurant' }),
        makeItem({ name: 'Cafe', category: 'cafe' }),
        makeItem({ name: 'Bar', category: 'bar' }),
      ];
      const { result } = renderHook(() => useListFilters(items));

      act(() => result.current.setCategoryFilter('cafe'));
      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].business!.name).toBe('Cafe');
    });

    it('combines search + category filter', () => {
      const items = [
        makeItem({ name: 'Parrilla Norte', category: 'restaurant' }),
        makeItem({ name: 'Parrilla Sur', category: 'bar' }),
        makeItem({ name: 'Café Central', category: 'cafe' }),
      ];
      const { result } = renderHook(() => useListFilters(items));

      act(() => {
        result.current.setSearchQuery('parrilla');
        result.current.setCategoryFilter('restaurant');
      });
      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].business!.name).toBe('Parrilla Norte');
    });

    it('ignores score filter when enableScoreFilter is false', () => {
      const items = [makeItem({ score: 1 }), makeItem({ score: 5 })];
      const { result } = renderHook(() => useListFilters(items));

      act(() => result.current.setMinScore(4));
      expect(result.current.filtered).toHaveLength(2);
    });

    it('applies score filter when enableScoreFilter is true', () => {
      const items = [
        makeItem({ score: 1 }),
        makeItem({ score: 3 }),
        makeItem({ score: 5 }),
      ];
      const { result } = renderHook(() =>
        useListFilters(items, { enableScoreFilter: true }),
      );

      act(() => result.current.setMinScore(3));
      expect(result.current.filtered).toHaveLength(2);
    });

    it('score filter treats missing score as 0', () => {
      const item = makeItem({});
      // @ts-expect-error testing missing score
      delete item.score;
      const items = [item, makeItem({ score: 5 })];
      const { result } = renderHook(() =>
        useListFilters(items, { enableScoreFilter: true }),
      );

      act(() => result.current.setMinScore(1));
      expect(result.current.filtered).toHaveLength(1);
    });
  });

  describe('sorting', () => {
    it('sorts by date-desc by default (newest first)', () => {
      const items = [
        makeItem({ name: 'Old', updatedAt: new Date('2024-01-01') }),
        makeItem({ name: 'New', updatedAt: new Date('2025-06-01') }),
        makeItem({ name: 'Mid', updatedAt: new Date('2025-01-01') }),
      ];
      const { result } = renderHook(() => useListFilters(items));

      const names = result.current.filtered.map((i) => i.business!.name);
      expect(names).toEqual(['New', 'Mid', 'Old']);
    });

    it('falls back to createdAt when updatedAt is missing', () => {
      const items = [
        makeItem({ name: 'A', createdAt: new Date('2024-01-01') }),
        makeItem({ name: 'B', createdAt: new Date('2025-01-01') }),
      ];
      const { result } = renderHook(() => useListFilters(items));

      expect(result.current.filtered[0].business!.name).toBe('B');
    });

    it('sorts date-asc (oldest first)', () => {
      const items = [
        makeItem({ name: 'New', updatedAt: new Date('2025-06-01') }),
        makeItem({ name: 'Old', updatedAt: new Date('2024-01-01') }),
      ];
      const { result } = renderHook(() => useListFilters(items));

      act(() => result.current.setSortBy('date-asc'));
      expect(result.current.filtered[0].business!.name).toBe('Old');
    });

    it('sorts name-asc (A-Z)', () => {
      const items = [
        makeItem({ name: 'Zebra' }),
        makeItem({ name: 'Alpha' }),
        makeItem({ name: 'Medio' }),
      ];
      const { result } = renderHook(() => useListFilters(items));

      act(() => result.current.setSortBy('name-asc'));
      const names = result.current.filtered.map((i) => i.business!.name);
      expect(names).toEqual(['Alpha', 'Medio', 'Zebra']);
    });

    it('sorts name-desc (Z-A)', () => {
      const items = [
        makeItem({ name: 'Alpha' }),
        makeItem({ name: 'Zebra' }),
      ];
      const { result } = renderHook(() => useListFilters(items));

      act(() => result.current.setSortBy('name-desc'));
      expect(result.current.filtered[0].business!.name).toBe('Zebra');
    });

    it('sorts score-desc (highest first)', () => {
      const items = [
        makeItem({ name: 'Low', score: 1 }),
        makeItem({ name: 'High', score: 5 }),
        makeItem({ name: 'Mid', score: 3 }),
      ];
      const { result } = renderHook(() => useListFilters(items));

      act(() => result.current.setSortBy('score-desc'));
      const names = result.current.filtered.map((i) => i.business!.name);
      expect(names).toEqual(['High', 'Mid', 'Low']);
    });

    it('sorts score-asc (lowest first)', () => {
      const items = [
        makeItem({ name: 'High', score: 5 }),
        makeItem({ name: 'Low', score: 1 }),
      ];
      const { result } = renderHook(() => useListFilters(items));

      act(() => result.current.setSortBy('score-asc'));
      expect(result.current.filtered[0].business!.name).toBe('Low');
    });
  });

  describe('total', () => {
    it('excludes null businesses from total', () => {
      const items = [makeItem({ name: 'A' }), makeItem({ business: null })];
      const { result } = renderHook(() => useListFilters(items));
      expect(result.current.total).toBe(1);
    });

    it('total is not affected by search filters', () => {
      const items = [makeItem({ name: 'Match' }), makeItem({ name: 'Other' })];
      const { result } = renderHook(() => useListFilters(items));

      act(() => result.current.setSearchQuery('Match'));
      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.total).toBe(2);
    });
  });
});
