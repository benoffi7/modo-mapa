import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box } from '@mui/material';
import MapView from '../map/MapView';
import LocationFAB from '../map/LocationFAB';
import SearchBar from '../search/SearchBar';
import FilterChips from '../search/FilterChips';
import BusinessSheet from '../business/BusinessSheet';
import NameDialog from '../auth/NameDialog';
import SideMenu from './SideMenu';
import { OfflineIndicator } from '../ui/OfflineIndicator';
import { useMapContext } from '../../context/MapContext';
import { allBusinesses } from '../../hooks/useBusinesses';

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { setSelectedBusiness } = useMapContext();

  // Deep link: ?business=biz_001 opens the business sheet
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
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </Box>
  );
}
