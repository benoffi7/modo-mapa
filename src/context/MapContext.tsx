import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Business } from '../types';

/* ─── Selection context (changes on marker click) ─── */

interface SelectionContextType {
  selectedBusiness: Business | null;
  setSelectedBusiness: (business: Business | null) => void;
}

const SelectionContext = createContext<SelectionContextType>({
  selectedBusiness: null,
  setSelectedBusiness: () => {},
});

/* ─── Filters context (changes on search/filter/location) ─── */

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

/* ─── Combined provider ─── */

export function MapProvider({ children }: { children: ReactNode }) {
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
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

  const selectionValue = useMemo<SelectionContextType>(() => ({
    selectedBusiness,
    setSelectedBusiness,
  }), [selectedBusiness]);

  const filtersValue = useMemo<FiltersContextType>(() => ({
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
    <SelectionContext.Provider value={selectionValue}>
      <FiltersContext.Provider value={filtersValue}>
        {children}
      </FiltersContext.Provider>
    </SelectionContext.Provider>
  );
}

/* ─── Hooks ─── */

export const useSelection = () => useContext(SelectionContext);
export const useFilters = () => useContext(FiltersContext);

/** @deprecated Use useSelection() or useFilters() directly */
export function useMapContext() {
  const selection = useContext(SelectionContext);
  const filters = useContext(FiltersContext);
  return { ...selection, ...filters };
}

export { SelectionContext, FiltersContext };
