import { useMemo } from 'react';
import { useTrending } from './useTrending';
import { useSortLocation } from './useSortLocation';
import { useUserSettings } from './useUserSettings';
import { useFilters } from '../context/FiltersContext';
import { allBusinesses } from './useBusinesses';
import { distanceKm } from '../utils/distance';
import {
  LOCAL_TRENDING_RADII,
  LOCAL_TRENDING_MIN_RESULTS,
  LOCAL_TRENDING_MAX_RESULTS,
} from '../constants/trending';
import type { TrendingBusiness, LocationSource } from '../types';

interface UseLocalTrendingResult {
  businesses: TrendingBusiness[];
  source: LocationSource;
  localityName: string | null;
  radiusKm: number;
  loading: boolean;
}

export function useLocalTrending(): UseLocalTrendingResult {
  const { data, loading } = useTrending();
  const location = useSortLocation();
  const { userLocation } = useFilters();
  const { settings } = useUserSettings();

  // Determine source
  const source: LocationSource = userLocation
    ? 'gps'
    : settings.localityLat && settings.localityLng
      ? 'locality'
      : 'office';

  const localityName = source === 'locality' ? (settings.locality ?? null) : null;

  // Build business coordinate lookup
  const businessCoords = useMemo(
    () => new Map(allBusinesses.map((b) => [b.id, { lat: b.lat, lng: b.lng }])),
    [],
  );

  // Filter trending businesses by distance with progressive radius expansion
  const { filtered, radiusKm } = useMemo(() => {
    if (!data?.businesses.length) return { filtered: [], radiusKm: LOCAL_TRENDING_RADII[0] };

    for (const radius of LOCAL_TRENDING_RADII) {
      const result = data.businesses.filter((biz) => {
        const coords = businessCoords.get(biz.businessId);
        if (!coords) return false;
        return distanceKm(location.lat, location.lng, coords.lat, coords.lng) <= radius;
      });

      if (result.length >= LOCAL_TRENDING_MIN_RESULTS || radius === LOCAL_TRENDING_RADII[LOCAL_TRENDING_RADII.length - 1]) {
        return {
          filtered: result
            .sort((a, b) => b.score - a.score)
            .slice(0, LOCAL_TRENDING_MAX_RESULTS),
          radiusKm: radius,
        };
      }
    }

    // Fallback (should not reach here, but just in case)
    return { filtered: [], radiusKm: LOCAL_TRENDING_RADII[LOCAL_TRENDING_RADII.length - 1] };
  }, [data, location.lat, location.lng, businessCoords]);

  return {
    businesses: filtered,
    source,
    localityName,
    radiusKm,
    loading,
  };
}
