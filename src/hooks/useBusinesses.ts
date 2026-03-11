import { useMemo } from 'react';
import { useMapContext } from '../context/MapContext';
import type { Business } from '../types';
import businessesData from '../data/businesses.json';

const allBusinesses: Business[] = businessesData as Business[];

export function useBusinesses() {
  const { searchQuery, activeFilters } = useMapContext();

  const filteredBusinesses = useMemo(() => {
    let result = allBusinesses;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.address.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q)
      );
    }

    if (activeFilters.length > 0) {
      result = result.filter((b) =>
        activeFilters.every((filter) => b.tags.includes(filter))
      );
    }

    return result;
  }, [searchQuery, activeFilters]);

  return { businesses: filteredBusinesses, allBusinesses };
}
