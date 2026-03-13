import { useMemo, useDeferredValue } from 'react';
import { useMapContext } from '../context/MapContext';
import { usePriceLevelFilter } from './usePriceLevelFilter';
import type { Business } from '../types';
import businessesData from '../data/businesses.json';

export const allBusinesses: Business[] = businessesData as Business[];

export function useBusinesses() {
  const { searchQuery, activeFilters, activePriceFilter } = useMapContext();
  const deferredQuery = useDeferredValue(searchQuery);
  const priceMap = usePriceLevelFilter();

  const filteredBusinesses = useMemo(() => {
    let result = allBusinesses;

    if (deferredQuery.trim()) {
      const q = deferredQuery.toLowerCase().trim();
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

    if (activePriceFilter !== null) {
      result = result.filter((b) => priceMap.get(b.id) === activePriceFilter);
    }

    return result;
  }, [deferredQuery, activeFilters, activePriceFilter, priceMap]);

  return { businesses: filteredBusinesses, allBusinesses };
}
