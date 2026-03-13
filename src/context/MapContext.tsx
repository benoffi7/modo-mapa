import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Business } from '../types';

interface MapContextType {
  selectedBusiness: Business | null;
  setSelectedBusiness: (business: Business | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilters: string[];
  toggleFilter: (tagId: string) => void;
  activePriceFilter: number | null;
  setPriceFilter: (level: number | null) => void;
  userLocation: { lat: number; lng: number } | null;
  setUserLocation: (location: { lat: number; lng: number } | null) => void;
}

const MapContext = createContext<MapContextType>({
  selectedBusiness: null,
  setSelectedBusiness: () => {},
  searchQuery: '',
  setSearchQuery: () => {},
  activeFilters: [],
  toggleFilter: () => {},
  activePriceFilter: null,
  setPriceFilter: () => {},
  userLocation: null,
  setUserLocation: () => {},
});

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

  const value = useMemo<MapContextType>(() => ({
    selectedBusiness,
    setSelectedBusiness,
    searchQuery,
    setSearchQuery,
    activeFilters,
    toggleFilter,
    activePriceFilter,
    setPriceFilter,
    userLocation,
    setUserLocation,
  }), [selectedBusiness, searchQuery, activeFilters, toggleFilter, activePriceFilter, setPriceFilter, userLocation]);

  return (
    <MapContext.Provider value={value}>
      {children}
    </MapContext.Provider>
  );
}

export { MapContext };
export const useMapContext = () => useContext(MapContext);
