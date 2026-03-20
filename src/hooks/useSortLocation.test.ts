import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSortLocation } from './useSortLocation';
import { OFFICE_LOCATION } from '../constants/map';

const mockUserLocation = { lat: -34.6, lng: -58.4 };
const mockLocalityCoords = { lat: -31.4, lng: -64.2 };

vi.mock('../context/MapContext', () => ({
  useFilters: vi.fn(() => ({ userLocation: null })),
}));

vi.mock('./useUserSettings', () => ({
  useUserSettings: vi.fn(() => ({ settings: {} as any })),
}));

import { useFilters } from '../context/MapContext';
import { useUserSettings } from './useUserSettings';

describe('useSortLocation', () => {
  beforeEach(() => {
    vi.mocked(useFilters).mockReturnValue({ userLocation: null } as ReturnType<typeof useFilters>);
    vi.mocked(useUserSettings).mockReturnValue({ settings: {} as any, loading: false, updateSetting: vi.fn(), updateLocality: vi.fn(), clearLocality: vi.fn() });
  });

  it('returns GPS location when available', () => {
    vi.mocked(useFilters).mockReturnValue({ userLocation: mockUserLocation } as ReturnType<typeof useFilters>);
    const { result } = renderHook(() => useSortLocation());
    expect(result.current).toEqual(mockUserLocation);
  });

  it('returns locality coords when no GPS but locality set', () => {
    vi.mocked(useUserSettings).mockReturnValue({
      settings: { localityLat: mockLocalityCoords.lat, localityLng: mockLocalityCoords.lng } as any,
      loading: false, updateSetting: vi.fn(), updateLocality: vi.fn(), clearLocality: vi.fn(),
    });
    const { result } = renderHook(() => useSortLocation());
    expect(result.current).toEqual(mockLocalityCoords);
  });

  it('returns OFFICE_LOCATION as last fallback', () => {
    const { result } = renderHook(() => useSortLocation());
    expect(result.current).toEqual(OFFICE_LOCATION);
  });

  it('GPS takes priority over locality', () => {
    vi.mocked(useFilters).mockReturnValue({ userLocation: mockUserLocation } as ReturnType<typeof useFilters>);
    vi.mocked(useUserSettings).mockReturnValue({
      settings: { localityLat: mockLocalityCoords.lat, localityLng: mockLocalityCoords.lng } as any,
      loading: false, updateSetting: vi.fn(), updateLocality: vi.fn(), clearLocality: vi.fn(),
    });
    const { result } = renderHook(() => useSortLocation());
    expect(result.current).toEqual(mockUserLocation);
  });
});
