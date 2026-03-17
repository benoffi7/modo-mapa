import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Snackbar, Alert, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MapView from '../map/MapView';
import LocationFAB from '../map/LocationFAB';
import SearchBar from '../search/SearchBar';
import FilterChips from '../search/FilterChips';
import BusinessSheet from '../business/BusinessSheet';
import NameDialog from '../auth/NameDialog';
import SideMenu from './SideMenu';
import { OfflineIndicator } from '../ui/OfflineIndicator';
import { useSelection } from '../../context/MapContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUserProfile';
import { allBusinesses } from '../../hooks/useBusinesses';
import { AUTO_DISMISS_MS } from '../../constants/timing';
import { STORAGE_KEY_HINT_FIRST_RATING } from '../../constants/storage';

function MapHint() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY_HINT_FIRST_RATING) === 'true',
  );
  const { user, displayName } = useAuth();
  const { profile } = useUserProfile(user?.uid ?? null, displayName ?? undefined);
  const { selectedBusiness } = useSelection();

  const dismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY_HINT_FIRST_RATING, 'true');
  }, []);

  // Close hint when a marker is selected
  useEffect(() => {
    if (selectedBusiness) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- dismiss hint when user taps a marker
      dismiss();
    }
  }, [selectedBusiness, dismiss]);

  if (dismissed || !user) return null;
  if (!profile || profile.stats.ratings > 0) return null;

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
        Toca un comercio en el mapa para calificarlo
      </Alert>
    </Snackbar>
  );
}

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuInitialSection, setMenuInitialSection] = useState<string | undefined>(undefined);
  const [sharedListId, setSharedListId] = useState<string | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();
  const { setSelectedBusiness } = useSelection();

  // Deep link: ?business=biz_001 opens the business sheet
  // Deep link: ?list=xxx opens SideMenu on lists section
  useEffect(() => {
    const bizId = searchParams.get('business');
    if (bizId) {
      const biz = allBusinesses.find((b) => b.id === bizId);
      if (biz) {
        setSelectedBusiness(biz);
      }
      searchParams.delete('business');
      setSearchParams(searchParams, { replace: true });
    }

    const listId = searchParams.get('list');
    if (listId) {
      setSharedListId(listId);
      setMenuInitialSection('lists');
      setMenuOpen(true);
      searchParams.delete('list');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only on mount
  }, []);

  return (
    <Box
      sx={{
        height: '100dvh',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <OfflineIndicator />
      <SearchBar onMenuClick={() => setMenuOpen(true)} />
      <FilterChips />
      <MapView />
      <LocationFAB />
      <BusinessSheet />
      <NameDialog />
      <MapHint />
      <SideMenu open={menuOpen} onClose={() => { setMenuOpen(false); setMenuInitialSection(undefined); setSharedListId(undefined); }} onOpen={() => setMenuOpen(true)} initialSection={menuInitialSection} sharedListId={sharedListId} />
    </Box>
  );
}
