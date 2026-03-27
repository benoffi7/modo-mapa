import { Box, Divider } from '@mui/material';
import GreetingHeader from './GreetingHeader';
import QuickActions from './QuickActions';
import SpecialsSection from './SpecialsSection';
import RecentSearches from './RecentSearches';
import ForYouSection from './ForYouSection';
import RatingPromptBanner from '../ui/RatingPromptBanner';
import { useRatingPrompt } from '../../hooks/useRatingPrompt';

export default function HomeScreen() {
  const ratingPrompt = useRatingPrompt();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <GreetingHeader />
      {ratingPrompt.promptData && (
        <RatingPromptBanner
          businessName={ratingPrompt.promptData.businessName}
          onRate={ratingPrompt.navigateToBusiness}
          onDismiss={ratingPrompt.dismiss}
        />
      )}
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
