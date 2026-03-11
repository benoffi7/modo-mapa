import { useState, useMemo } from 'react';
import type { Business, BusinessCategory } from '../types';

export type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'score-desc' | 'score-asc';

interface FilterableItem {
  business: Business | null;
  score?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UseListFiltersOptions {
  enableScoreFilter?: boolean;
}

interface UseListFiltersReturn<T> {
  filtered: T[];
  total: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  categoryFilter: BusinessCategory | null;
  setCategoryFilter: (c: BusinessCategory | null) => void;
  minScore: number | null;
  setMinScore: (s: number | null) => void;
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;
}

export function useListFilters<T extends FilterableItem>(
  items: T[],
  options: UseListFiltersOptions = {},
): UseListFiltersReturn<T> {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<BusinessCategory | null>(null);
  const [minScore, setMinScore] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');

  const filtered = useMemo(() => {
    let result = items.filter((item) => item.business !== null);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((item) => item.business!.name.toLowerCase().includes(q));
    }

    if (categoryFilter) {
      result = result.filter((item) => item.business!.category === categoryFilter);
    }

    if (options.enableScoreFilter && minScore !== null) {
      result = result.filter((item) => (item.score ?? 0) >= minScore);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc': {
          const dateA = a.updatedAt ?? a.createdAt ?? new Date(0);
          const dateB = b.updatedAt ?? b.createdAt ?? new Date(0);
          return dateB.getTime() - dateA.getTime();
        }
        case 'date-asc': {
          const dateA = a.updatedAt ?? a.createdAt ?? new Date(0);
          const dateB = b.updatedAt ?? b.createdAt ?? new Date(0);
          return dateA.getTime() - dateB.getTime();
        }
        case 'name-asc':
          return (a.business!.name).localeCompare(b.business!.name);
        case 'name-desc':
          return (b.business!.name).localeCompare(a.business!.name);
        case 'score-desc':
          return (b.score ?? 0) - (a.score ?? 0);
        case 'score-asc':
          return (a.score ?? 0) - (b.score ?? 0);
        default:
          return 0;
      }
    });

    return result;
  }, [items, searchQuery, categoryFilter, minScore, sortBy, options.enableScoreFilter]);

  return {
    filtered,
    total: items.filter((item) => item.business !== null).length,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    minScore,
    setMinScore,
    sortBy,
    setSortBy,
  };
}
