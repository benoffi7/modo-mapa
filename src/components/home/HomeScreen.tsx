import { Box, Divider } from '@mui/material';
import GreetingHeader from './GreetingHeader';
import QuickActions from './QuickActions';
import SpecialsSection from './SpecialsSection';
import RecentSearches from './RecentSearches';
import ForYouSection from './ForYouSection';

export default function HomeScreen() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <GreetingHeader />
      <QuickActions />
      <Divider sx={{ my: 0.5 }} />
      <SpecialsSection />
      <Divider sx={{ my: 0.5 }} />
      <RecentSearches />
      <Divider sx={{ my: 0.5 }} />
      <ForYouSection />
    </Box>
  );
}
