import { useCallback, useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { Map, useMap } from '@vis.gl/react-google-maps';
import { useMapContext } from '../../context/MapContext';
import { useBusinesses } from '../../hooks/useBusinesses';
import { BUENOS_AIRES_CENTER } from '../../constants/map';
import BusinessMarker from './BusinessMarker';

export default function MapView() {
  const map = useMap();
  const { selectedBusiness, setSelectedBusiness, userLocation, searchQuery, activeFilters } = useMapContext();
  const { businesses } = useBusinesses();
  const hasActiveFilters = searchQuery.trim().length > 0 || activeFilters.length > 0;
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
    <>
      <Map
        defaultCenter={BUENOS_AIRES_CENTER}
        defaultZoom={13}
        mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
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
      {hasActiveFilters && businesses.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            bgcolor: 'rgba(255,255,255,0.95)',
            borderRadius: 2,
            px: 3,
            py: 2,
            boxShadow: 2,
            zIndex: 1050,
          }}
        >
          <SearchOffIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No se encontraron comercios
          </Typography>
        </Box>
      )}
    </>
  );
}
