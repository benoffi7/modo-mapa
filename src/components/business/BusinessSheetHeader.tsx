import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { Box, Divider } from '@mui/material';
import BusinessHeader from './BusinessHeader';
import BusinessRating from './BusinessRating';
import DirectionsButton from './DirectionsButton';
import { useFilters } from '../../context/FiltersContext';
import type { Business, Rating } from '../../types';
import type { UseBusinessRatingReturn } from '../../hooks/useBusinessRating';

interface Props {
  business: Business;
  isTrending: boolean;
  ratings: Rating[];
  isLoading: boolean;
  ratingData: UseBusinessRatingReturn;
  favoriteButton: ReactNode;
  shareButton: ReactNode;
  recommendButton?: ReactNode;
  addToListButton?: ReactNode;
  checkInButton: ReactNode;
}

const BusinessSheetHeader = forwardRef<HTMLDivElement, Props>(function BusinessSheetHeader(
  { business, isTrending, ratings, isLoading, ratingData, favoriteButton, shareButton, recommendButton, addToListButton, checkInButton },
  ref,
) {
  const { userLocation } = useFilters();

  return (
    <Box
      ref={ref}
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        bgcolor: 'background.paper',
        px: 2,
        pt: 0,
        pb: 0,
      }}
    >
      <BusinessHeader
        business={business}
        isTrending={isTrending}
        favoriteButton={favoriteButton}
        shareButton={shareButton}
        recommendButton={recommendButton}
        addToListButton={addToListButton}
      />
      <Box sx={{
        my: 1,
        display: 'flex',
        justifyContent: 'center',
        gap: 1,
        '& > *': { flex: { xs: 1, sm: 'none' }, maxWidth: { sm: '50%' } },
      }}>
        {checkInButton}
        <DirectionsButton business={business} userLocation={userLocation} />
      </Box>
      <BusinessRating
        ratingData={ratingData}
        ratings={ratings}
        isLoading={isLoading}
      />
      <Divider />
    </Box>
  );
});

export default BusinessSheetHeader;
