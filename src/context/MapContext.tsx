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
  userLocation: null,
  setUserLocation: () => {},
});

export function MapProvider({ children }: { children: ReactNode }) {
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const toggleFilter = useCallback((tagId: string) => {
    setActiveFilters((prev) =>
      prev.includes(tagId) ? prev.filter((f) => f !== tagId) : [...prev, tagId]
    );
  }, []);

  const value = useMemo<MapContextType>(() => ({
    selectedBusiness,
    setSelectedBusiness,
    searchQuery,
    setSearchQuery,
    activeFilters,
    toggleFilter,
    userLocation,
    setUserLocation,
  }), [selectedBusiness, searchQuery, activeFilters, toggleFilter, userLocation]);

  return (
    <MapContext.Provider value={value}>
      {children}
    </MapContext.Provider>
  );
}

export { MapContext };
export const useMapContext = () => useContext(MapContext);
