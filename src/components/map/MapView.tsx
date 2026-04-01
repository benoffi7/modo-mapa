import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import MapIcon from '@mui/icons-material/Map';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Map, useMap } from '@vis.gl/react-google-maps';

function MapLoadError() {
  return (
    <Box
      sx={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        bgcolor: 'background.default', gap: 2, px: 3,
      }}
    >
      <MapIcon sx={{ fontSize: 56, color: 'text.secondary' }} />
      <Typography variant="body1" color="text.secondary" textAlign="center">
        No se pudo cargar el mapa.
      </Typography>
      <Button variant="outlined" onClick={() => window.location.reload()} startIcon={<RefreshIcon />}>
        Reintentar
      </Button>
    </Box>
  );
}
import { useSelection } from '../../context/SelectionContext';
import { useFilters } from '../../context/FiltersContext';
import { useBusinesses } from '../../hooks/useBusinesses';
import { useUserSettings } from '../../hooks/useUserSettings';
import { BUENOS_AIRES_CENTER } from '../../constants/map';
import BusinessMarker from './BusinessMarker';
import OfficeMarker from './OfficeMarker';
import MapSkeleton from './MapSkeleton';

export default function MapView() {
  const map = useMap();
  const { selectedBusiness, setSelectedBusiness } = useSelection();
  const selectedId = selectedBusiness?.id ?? null;
  const { userLocation, searchQuery, activeFilters } = useFilters();
  const { businesses } = useBusinesses();
  const { settings } = useUserSettings();
  const hasActiveFilters = searchQuery.trim().length > 0 || activeFilters.length > 0;
  const hasInitialLocation = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (mapReady) return;
    const timer = setTimeout(() => {
      if (!mapReady) setMapError(true);
    }, 10_000);
    return () => clearTimeout(timer);
  }, [mapReady]);

  // Stable ref for businesses so handleMarkerClick doesn't invalidate memo'd markers
  const businessesRef = useRef(businesses);
  useEffect(() => {
    businessesRef.current = businesses;
  }, [businesses]);

  // Pan to user GPS location whenever it changes
  useEffect(() => {
    if (!map || !userLocation) return;
    if (!hasInitialLocation.current) {
      map.setZoom(15);
      hasInitialLocation.current = true;
    }
    map.panTo(userLocation);
  }, [map, userLocation]);

  // Pan to locality if no GPS and locality is set (initial only)
  useEffect(() => {
    if (map && !userLocation && !hasInitialLocation.current && settings.localityLat && settings.localityLng) {
      map.panTo({ lat: settings.localityLat, lng: settings.localityLng });
      map.setZoom(14);
      hasInitialLocation.current = true;
    }
  }, [map, userLocation, settings.localityLat, settings.localityLng]);

  const handleMarkerClick = useCallback(
    (businessId: string) => {
      const business = businessesRef.current.find((b) => b.id === businessId);
      if (business) {
        setSelectedBusiness(business);
        map?.panTo({ lat: business.lat, lng: business.lng });
      }
    },
    [setSelectedBusiness, map]
  );

  const handleMapClick = useCallback(() => {
    setSelectedBusiness(null);
  }, [setSelectedBusiness]);

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
        onTilesLoaded={() => setMapReady(true)}
        style={{ width: '100%', height: '100%' }}
      >
        {businesses.map((business) => (
          <BusinessMarker
            key={business.id}
            business={business}
            isSelected={business.id === selectedId}
            onClick={handleMarkerClick}
            averageRating={null}
          />
        ))}
        <OfficeMarker />
      </Map>
      {!mapReady && !mapError && <MapSkeleton />}
      {mapError && <MapLoadError />}
      {hasActiveFilters && businesses.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            bgcolor: (theme) => `rgba(${theme.palette.mode === 'dark' ? '30,30,30' : '255,255,255'},0.95)`,
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
