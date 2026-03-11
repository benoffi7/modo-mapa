import { Box } from '@mui/material';
import MapView from '../map/MapView';
import LocationFAB from '../map/LocationFAB';
import SearchBar from '../search/SearchBar';
import FilterChips from '../search/FilterChips';
import BusinessSheet from '../business/BusinessSheet';
import NameDialog from '../auth/NameDialog';

export default function AppShell() {
  return (
    <Box
      sx={{
        height: '100dvh',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <SearchBar />
      <FilterChips />
      <MapView />
      <LocationFAB />
      <BusinessSheet />
      <NameDialog />
    </Box>
  );
}
