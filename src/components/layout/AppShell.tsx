import { useState } from 'react';
import { Box } from '@mui/material';
import MapView from '../map/MapView';
import LocationFAB from '../map/LocationFAB';
import SearchBar from '../search/SearchBar';
import FilterChips from '../search/FilterChips';
import BusinessSheet from '../business/BusinessSheet';
import NameDialog from '../auth/NameDialog';
import SideMenu from './SideMenu';
import { OfflineIndicator } from '../ui/OfflineIndicator';

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);

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
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </Box>
  );
}
