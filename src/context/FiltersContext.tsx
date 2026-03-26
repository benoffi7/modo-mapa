import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

interface FiltersContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilters: string[];
  toggleFilter: (tagId: string) => void;
  activePriceFilter: number | null;
  setPriceFilter: (level: number | null) => void;
  userLocation: { lat: number; lng: number } | null;
  setUserLocation: (location: { lat: number; lng: number } | null) => void;
}

const FiltersContext = createContext<FiltersContextType>({
  searchQuery: '',
  setSearchQuery: () => {},
  activeFilters: [],
  toggleFilter: () => {},
  activePriceFilter: null,
  setPriceFilter: () => {},
  userLocation: null,
  setUserLocation: () => {},
});

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activePriceFilter, setActivePriceFilter] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const toggleFilter = useCallback((tagId: string) => {
    setActiveFilters((prev) =>
      prev.includes(tagId) ? prev.filter((f) => f !== tagId) : [...prev, tagId]
    );
  }, []);

  const setPriceFilter = useCallback((level: number | null) => {
    setActivePriceFilter((prev) => prev === level ? null : level);
  }, []);

  const value = useMemo<FiltersContextType>(() => ({
    searchQuery,
    setSearchQuery,
    activeFilters,
    toggleFilter,
    activePriceFilter,
    setPriceFilter,
    userLocation,
    setUserLocation,
  }), [searchQuery, activeFilters, toggleFilter, activePriceFilter, setPriceFilter, userLocation]);

  return (
    <FiltersContext.Provider value={value}>
      {children}
    </FiltersContext.Provider>
  );
}

export const useFilters = () => useContext(FiltersContext);
export { FiltersContext };
