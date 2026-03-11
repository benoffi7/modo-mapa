import { useCallback, useEffect, useRef } from 'react';
import { Map, useMap } from '@vis.gl/react-google-maps';
import { useMapContext } from '../../context/MapContext';
import { useBusinesses } from '../../hooks/useBusinesses';
import BusinessMarker from './BusinessMarker';

const BUENOS_AIRES_CENTER = { lat: -34.6037, lng: -58.3816 };

export default function MapView() {
  const map = useMap();
  const { selectedBusiness, setSelectedBusiness, userLocation } = useMapContext();
  const { businesses } = useBusinesses();
  const hasInitialLocation = useRef(false);

  useEffect(() => {
    if (map && userLocation && !hasInitialLocation.current) {
      map.panTo(userLocation);
      map.setZoom(15);
      hasInitialLocation.current = true;
    }
  }, [map, userLocation]);

  useEffect(() => {
    if (map && userLocation && hasInitialLocation.current) {
      map.panTo(userLocation);
    }
  }, [map, userLocation]);

  const handleMarkerClick = useCallback(
    (businessId: string) => {
      const business = businesses.find((b) => b.id === businessId);
      if (business) {
        setSelectedBusiness(business);
        map?.panTo({ lat: business.lat, lng: business.lng });
      }
    },
    [businesses, setSelectedBusiness, map]
  );

  const handleMapClick = useCallback(() => {
    if (selectedBusiness) {
      setSelectedBusiness(null);
    }
  }, [selectedBusiness, setSelectedBusiness]);

  return (
    <Map
      defaultCenter={BUENOS_AIRES_CENTER}
      defaultZoom={13}
      mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || undefined}
      gestureHandling="greedy"
      disableDefaultUI
      clickableIcons={false}
      onClick={handleMapClick}
      style={{ width: '100%', height: '100%' }}
    >
      {businesses.map((business) => (
        <BusinessMarker
          key={business.id}
          business={business}
          isSelected={selectedBusiness?.id === business.id}
          onClick={handleMarkerClick}
        />
      ))}
    </Map>
  );
}
