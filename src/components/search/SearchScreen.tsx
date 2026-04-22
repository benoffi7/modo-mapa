import { useState, useEffect, useRef } from 'react';
import { Box, Snackbar, Alert, IconButton, ToggleButtonGroup, ToggleButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import { APIProvider } from '@vis.gl/react-google-maps';
import MapView from '../map/MapView';
import LocationFAB from '../map/LocationFAB';
import OfficeFAB from '../map/OfficeFAB';
import SearchBar from './SearchBar';
import FilterChips from './FilterChips';
import SearchListView from './SearchListView';
import BusinessSheet from '../business/BusinessSheet';
import MapErrorBoundary from './MapErrorBoundary';
import { FiltersProvider, useFilters } from '../../context/FiltersContext';
import { useSelection } from '../../context/SelectionContext';
import { useTab } from '../../context/TabContext';
import { CATEGORY_LABELS } from '../../constants/business';
import type { BusinessCategory } from '../../types';
import { AUTO_DISMISS_MS } from '../../constants/timing';
import { useOnboardingHint } from '../../hooks/useOnboardingHint';
import { trackEvent } from '../../utils/analytics';
import { MSG_COMMON } from '../../constants/messages';
import type { SearchViewMode } from '../../types';

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
          <IconButton size="small" color="inherit" aria-label={MSG_COMMON.closeNoticeAriaLabel} onClick={dismiss}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        Tocá un comercio en el mapa para calificarlo
      </Alert>
    </Snackbar>
  );
}

function ViewToggle({ mode, onChange }: { mode: SearchViewMode; onChange: (m: SearchViewMode) => void }) {
  return (
    <ToggleButtonGroup
      value={mode}
      exclusive
      onChange={(_, val) => {
        if (val) {
          trackEvent('search_view_toggled', { mode: val });
          onChange(val);
        }
      }}
      size="small"
      sx={{
        position: 'absolute',
        top: 'calc(var(--search-bar-top, 16px) + var(--search-bar-height, 56px) + 52px)',
        right: 16,
        zIndex: 1100,
        bgcolor: 'background.paper',
        boxShadow: 2,
        borderRadius: 2,
      }}
    >
      <ToggleButton value="map" aria-label="Vista mapa">
        <MapOutlinedIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton value="list" aria-label="Vista lista">
        <ViewListOutlinedIcon fontSize="small" />
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

/**
 * Bridge: reads searchFilter from TabContext (one-shot) and applies it to FiltersContext.
 * This enables cross-tab navigation like QuickActions → Buscar with filter pre-loaded.
 */
function SearchFilterBridge() {
  const { activeTab, searchFilter, setSearchFilter } = useTab();
  const { setSearchQuery, toggleFilter } = useFilters();

  useEffect(() => {
    if (activeTab === 'buscar' && searchFilter) {
      if (searchFilter.type === 'text') {
        setSearchQuery(searchFilter.value);
      } else if (searchFilter.type === 'category') {
        const label = CATEGORY_LABELS[searchFilter.value as BusinessCategory] ?? searchFilter.value;
        setSearchQuery(label);
      } else if (searchFilter.type === 'tag') {
        toggleFilter(searchFilter.value);
      }
      setSearchFilter(null);
    }
  }, [activeTab, searchFilter, setSearchFilter, setSearchQuery, toggleFilter]);

  return null;
}

/**
 * SearchScreen — the "Buscar" tab content.
 * Owns its own FiltersProvider and Google Maps APIProvider.
 * Supports map/list toggle view.
 */
export default function SearchScreen() {
  const [viewMode, setViewMode] = useState<SearchViewMode>(
    GOOGLE_MAPS_API_KEY ? 'map' : 'list',
  );

  return (
    <FiltersProvider>
      <SearchFilterBridge />
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
        <ViewToggle mode={viewMode} onChange={setViewMode} />
        {viewMode === 'map' && GOOGLE_MAPS_API_KEY ? (
          <MapErrorBoundary onFallback={() => setViewMode('list')}>
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
              <MapView />
              <LocationFAB />
              <OfficeFAB />
              <MapHint />
            </APIProvider>
          </MapErrorBoundary>
        ) : (
          <Box sx={{
            position: 'absolute',
            top: 'calc(var(--search-bar-top, 16px) + var(--search-bar-height, 56px) + 52px + 48px)',
            bottom: 0,
            left: 0,
            right: 0,
            overflow: 'auto',
            bgcolor: 'background.default',
          }}>
            <SearchListView />
          </Box>
        )}
        <BusinessSheet />
      </Box>
    </FiltersProvider>
  );
}
