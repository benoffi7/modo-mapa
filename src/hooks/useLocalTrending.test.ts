import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Business, TrendingBusiness, TrendingData } from '../types';

const mockDistanceKm = vi.fn();

vi.mock('../utils/distance', () => ({
  distanceKm: (...args: unknown[]) => mockDistanceKm(...args),
}));

vi.mock('../utils/logger', () => ({ logger: { error: vi.fn() } }));

let mockTrendingData: TrendingData | null = null;
let mockTrendingLoading = false;
vi.mock('./useTrending', () => ({
  useTrending: () => ({ data: mockTrendingData, loading: mockTrendingLoading }),
}));

let mockSortLocation = { lat: -34.6, lng: -58.4 };
vi.mock('./useSortLocation', () => ({
  useSortLocation: () => mockSortLocation,
}));

let mockUserLocation: { lat: number; lng: number } | null = null;
vi.mock('../context/FiltersContext', () => ({
  useFilters: () => ({ userLocation: mockUserLocation }),
}));

let mockSettings: Record<string, unknown> = {};
vi.mock('./useUserSettings', () => ({
  useUserSettings: () => ({ settings: mockSettings }),
}));

const fakeBusiness = (id: string, lat: number, lng: number): Business => ({
  id,
  name: `Business ${id}`,
  address: 'Addr',
  category: 'restaurant',
  lat,
  lng,
  tags: [],
  phone: null,
});

let mockAllBusinesses: Business[] = [];
vi.mock('./useBusinesses', () => ({
  get allBusinesses() {
    return mockAllBusinesses;
  },
}));

import { useLocalTrending } from './useLocalTrending';

function makeTrendingBusiness(businessId: string, score: number): TrendingBusiness {
  return {
    businessId,
    name: `Business ${businessId}`,
    category: 'restaurant',
    score,
    breakdown: { ratings: 1, comments: 1, userTags: 0, priceLevels: 0, listItems: 0 },
    rank: 1,
  };
}

describe('useLocalTrending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserLocation = null;
    mockSettings = {};
    mockSortLocation = { lat: -34.6, lng: -58.4 };
    mockTrendingLoading = false;

    mockAllBusinesses = [
      fakeBusiness('b1', -34.601, -58.401),
      fakeBusiness('b2', -34.62, -58.42),
      fakeBusiness('b3', -34.7, -58.5),
    ];

    mockTrendingData = {
      businesses: [
        makeTrendingBusiness('b1', 100),
        makeTrendingBusiness('b2', 80),
        makeTrendingBusiness('b3', 50),
      ],
      computedAt: new Date(),
      periodStart: new Date(),
      periodEnd: new Date(),
    };
  });

  it('filters trending businesses within radius and sorts by score', () => {
    // b1 and b2 within 1km, b3 at 5km
    mockDistanceKm.mockImplementation((_lat1: number, _lng1: number, lat2: number) => {
      if (lat2 === -34.601) return 0.5;
      if (lat2 === -34.62) return 0.8;
      return 12; // b3 far away
    });

    const { result } = renderHook(() => useLocalTrending());

    // Should pick 1km radius (2 results < MIN_RESULTS=5, but progressive expansion tries bigger radii)
    // Actually with 2 results < 5, it should expand. All radii tried, last radius used.
    // At 2km: still only b1+b2. At 5km: still only b1+b2. Last radius = 5.
    expect(result.current.businesses).toHaveLength(2);
    expect(result.current.businesses[0].businessId).toBe('b1'); // score 100
    expect(result.current.businesses[1].businessId).toBe('b2'); // score 80
  });

  it('returns empty businesses when trending data is null', () => {
    mockTrendingData = null;
    const { result } = renderHook(() => useLocalTrending());

    expect(result.current.businesses).toEqual([]);
    expect(result.current.radiusKm).toBe(1); // first radius as default
  });

  it('returns empty businesses when trending data has no businesses', () => {
    mockTrendingData = {
      businesses: [],
      computedAt: new Date(),
      periodStart: new Date(),
      periodEnd: new Date(),
    };
    const { result } = renderHook(() => useLocalTrending());

    expect(result.current.businesses).toEqual([]);
  });

  it('source is gps when userLocation is set', () => {
    mockUserLocation = { lat: -34.6, lng: -58.4 };
    mockDistanceKm.mockReturnValue(100);
    const { result } = renderHook(() => useLocalTrending());

    expect(result.current.source).toBe('gps');
  });

  it('source is locality when userLocation is null but settings has locality coords', () => {
    mockUserLocation = null;
    mockSettings = { localityLat: -34.5, localityLng: -58.3, locality: 'Palermo' };
    mockDistanceKm.mockReturnValue(100);
    const { result } = renderHook(() => useLocalTrending());

    expect(result.current.source).toBe('locality');
    expect(result.current.localityName).toBe('Palermo');
  });

  it('source is office when neither gps nor locality are available', () => {
    mockUserLocation = null;
    mockSettings = {};
    mockDistanceKm.mockReturnValue(100);
    const { result } = renderHook(() => useLocalTrending());

    expect(result.current.source).toBe('office');
    expect(result.current.localityName).toBeNull();
  });

  it('passes loading state from useTrending', () => {
    mockTrendingLoading = true;
    mockDistanceKm.mockReturnValue(100);
    const { result } = renderHook(() => useLocalTrending());

    expect(result.current.loading).toBe(true);
  });

  it('limits results to LOCAL_TRENDING_MAX_RESULTS', () => {
    // Create many trending businesses all within range
    mockAllBusinesses = Array.from({ length: 20 }, (_, i) =>
      fakeBusiness(`b${i}`, -34.6 + i * 0.001, -58.4),
    );
    mockTrendingData = {
      businesses: Array.from({ length: 20 }, (_, i) =>
        makeTrendingBusiness(`b${i}`, 100 - i),
      ),
      computedAt: new Date(),
      periodStart: new Date(),
      periodEnd: new Date(),
    };
    mockDistanceKm.mockReturnValue(0.5); // all within 1km

    const { result } = renderHook(() => useLocalTrending());

    expect(result.current.businesses).toHaveLength(8); // LOCAL_TRENDING_MAX_RESULTS
    // Should be sorted by score descending
    expect(result.current.businesses[0].score).toBeGreaterThanOrEqual(result.current.businesses[1].score);
  });
});
