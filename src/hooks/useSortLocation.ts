import { useFilters } from '../context/FiltersContext';
import { useUserSettings } from './useUserSettings';
import { OFFICE_LOCATION } from '../constants/map';

/** Location fallback chain: GPS → user locality → office */
export function useSortLocation() {
  const { userLocation } = useFilters();
  const { settings } = useUserSettings();

  if (userLocation) return userLocation;
  if (settings.localityLat && settings.localityLng) {
    return { lat: settings.localityLat, lng: settings.localityLng };
  }
  return OFFICE_LOCATION;
}
