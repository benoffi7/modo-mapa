import { useEffect, useRef } from 'react';
import { Box, Snackbar, Alert, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { APIProvider } from '@vis.gl/react-google-maps';
import MapView from '../map/MapView';
import LocationFAB from '../map/LocationFAB';
import OfficeFAB from '../map/OfficeFAB';
import SearchBar from './SearchBar';
import FilterChips from './FilterChips';
import BusinessSheet from '../business/BusinessSheet';
import { FiltersProvider } from '../../context/FiltersContext';
import { useSelection } from '../../context/SelectionContext';
import { AUTO_DISMISS_MS } from '../../constants/timing';
import { useOnboardingHint } from '../../hooks/useOnboardingHint';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function MapHint() {
  const { show, dismiss } = useOnboardingHint();
  const { selectedBusiness } = useSelection();

  const prevBusiness = useRef(selectedBusiness);
  useEffect(() => {
    if (selectedBusiness && !prevBusiness.current && show) dismiss();
    prevBusiness.current = selectedBusiness;
  }, [selectedBusiness, show, dismiss]);

  if (!show) return null;

  return (
    <Snackbar
      open
      autoHideDuration={AUTO_DISMISS_MS}
      onClose={dismiss}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity="info"
        variant="filled"
        action={
          <IconButton size="small" color="inherit" onClick={dismiss}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        Tocá un comercio en el mapa para calificarlo
      </Alert>
    </Snackbar>
  );
}

/**
 * SearchScreen — the "Buscar" tab content.
 * Contains the map, search bar, filters, FABs, business sheet, and hint.
 * Self-contained: can be mounted inside any layout.
 */
/**
 * SearchScreen — the "Buscar" tab content.
 * Owns its own FiltersProvider and Google Maps APIProvider.
 * SelectionProvider lives above (global) so other tabs can read selectedBusiness.
 */
export default function SearchScreen() {
  return (
    <FiltersProvider>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
        <Box
          sx={{
            height: '100%',
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <SearchBar />
          <FilterChips />
          <MapView />
          <LocationFAB />
          <OfficeFAB />
          <BusinessSheet />
          <MapHint />
        </Box>
      </APIProvider>
    </FiltersProvider>
  );
}
