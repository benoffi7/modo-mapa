import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSortLocation } from './useSortLocation';
import { OFFICE_LOCATION } from '../constants/map';
import type { UserSettings } from '../types';

const mockUserLocation = { lat: -34.6, lng: -58.4 };
const mockLocalityCoords = { lat: -31.4, lng: -64.2 };

const MOCK_SETTINGS: UserSettings = {
  profilePublic: false,
  notificationsEnabled: false,
  notifyLikes: false,
  notifyPhotos: false,
  notifyRankings: false,
  notifyFeedback: true,
  notifyReplies: true,
  notifyFollowers: true,
  notifyRecommendations: true,
  analyticsEnabled: false,
  updatedAt: new Date(),
};

vi.mock('../context/FiltersContext', () => ({
  useFilters: vi.fn(() => ({ userLocation: null })),
}));

vi.mock('./useUserSettings', () => ({
  useUserSettings: vi.fn(() => ({ settings: { ...MOCK_SETTINGS } })),
}));

import { useFilters } from '../context/FiltersContext';
import { useUserSettings } from './useUserSettings';

const mockReturn = (overrides: Partial<UserSettings> = {}) => ({
  settings: { ...MOCK_SETTINGS, ...overrides },
  loading: false,
  updateSetting: vi.fn(),
  updateDigestFrequency: vi.fn(),
  updateLocality: vi.fn(),
  clearLocality: vi.fn(),
});

describe('useSortLocation', () => {
  beforeEach(() => {
    vi.mocked(useFilters).mockReturnValue({ userLocation: null } as ReturnType<typeof useFilters>);
    vi.mocked(useUserSettings).mockReturnValue(mockReturn());
  });

  it('returns GPS location when available', () => {
    vi.mocked(useFilters).mockReturnValue({ userLocation: mockUserLocation } as ReturnType<typeof useFilters>);
    const { result } = renderHook(() => useSortLocation());
    expect(result.current).toEqual(mockUserLocation);
  });

  it('returns locality coords when no GPS but locality set', () => {
    vi.mocked(useUserSettings).mockReturnValue(mockReturn({ localityLat: mockLocalityCoords.lat, localityLng: mockLocalityCoords.lng }));
    const { result } = renderHook(() => useSortLocation());
    expect(result.current).toEqual(mockLocalityCoords);
  });

  it('returns OFFICE_LOCATION as last fallback', () => {
    const { result } = renderHook(() => useSortLocation());
    expect(result.current).toEqual(OFFICE_LOCATION);
  });

  it('GPS takes priority over locality', () => {
    vi.mocked(useFilters).mockReturnValue({ userLocation: mockUserLocation } as ReturnType<typeof useFilters>);
    vi.mocked(useUserSettings).mockReturnValue(mockReturn({ localityLat: mockLocalityCoords.lat, localityLng: mockLocalityCoords.lng }));
    const { result } = renderHook(() => useSortLocation());
    expect(result.current).toEqual(mockUserLocation);
  });
});
