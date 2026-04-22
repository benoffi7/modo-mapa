import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FiltersProvider, useFilters } from './FiltersContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return <FiltersProvider>{children}</FiltersProvider>;
}

describe('FiltersContext', () => {
  it('starts with empty state', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    expect(result.current.searchQuery).toBe('');
    expect(result.current.activeFilters).toEqual([]);
    expect(result.current.activePriceFilter).toBeNull();
    expect(result.current.userLocation).toBeNull();
  });

  it('setSearchQuery updates the query', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    act(() => result.current.setSearchQuery('pizza'));
    expect(result.current.searchQuery).toBe('pizza');
  });

  it('toggleFilter adds a filter when not present', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    act(() => result.current.toggleFilter('coffee'));
    expect(result.current.activeFilters).toContain('coffee');
  });

  it('toggleFilter removes a filter when already present', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    act(() => result.current.toggleFilter('coffee'));
    act(() => result.current.toggleFilter('coffee'));
    expect(result.current.activeFilters).not.toContain('coffee');
  });

  it('setPriceFilter sets the level', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    act(() => result.current.setPriceFilter(2));
    expect(result.current.activePriceFilter).toBe(2);
  });

  it('setPriceFilter toggles off when same level clicked again', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    act(() => result.current.setPriceFilter(2));
    act(() => result.current.setPriceFilter(2));
    expect(result.current.activePriceFilter).toBeNull();
  });

  it('setUserLocation sets and clears location', () => {
    const { result } = renderHook(() => useFilters(), { wrapper });
    act(() => result.current.setUserLocation({ lat: -34.6, lng: -58.4 }));
    expect(result.current.userLocation).toEqual({ lat: -34.6, lng: -58.4 });
    act(() => result.current.setUserLocation(null));
    expect(result.current.userLocation).toBeNull();
  });
});
