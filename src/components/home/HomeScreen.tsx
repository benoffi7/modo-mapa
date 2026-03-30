import { Suspense } from 'react';
import { Box, Divider } from '@mui/material';
import { HOME_SECTIONS } from './homeSections';
import RatingPromptBanner from '../ui/RatingPromptBanner';
import { useRatingPrompt } from '../../hooks/useRatingPrompt';

export default function HomeScreen() {
  const ratingPrompt = useRatingPrompt();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {HOME_SECTIONS.map(({ id, component: Section, hasDividerAfter }, index) => (
        <Suspense key={id} fallback={null}>
          {index === 1 && ratingPrompt.promptData && (
            <RatingPromptBanner
              businessName={ratingPrompt.promptData.businessName}
              onRate={ratingPrompt.navigateToBusiness}
              onDismiss={ratingPrompt.dismiss}
            />
          )}
          <Section />
          {hasDividerAfter && <Divider sx={{ my: 0.5 }} />}
        </Suspense>
      ))}
    </Box>
  );
}
