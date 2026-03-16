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
import { useSelection } from '../../context/MapContext';
import { allBusinesses } from '../../hooks/useBusinesses';

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuInitialSection, setMenuInitialSection] = useState<string | undefined>(undefined);
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
      <SideMenu open={menuOpen} onClose={() => { setMenuOpen(false); setMenuInitialSection(undefined); }} initialSection={menuInitialSection} />
    </Box>
  );
}
