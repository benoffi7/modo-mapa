import { memo } from 'react';
import { Box, Divider } from '@mui/material';
import CriteriaSection from './CriteriaSection';
import BusinessPriceLevel from './BusinessPriceLevel';
import BusinessTags from './BusinessTags';
import MenuPhotoSection from './MenuPhotoSection';
import type { UseBusinessRatingReturn } from '../../hooks/useBusinessRating';
import type { Business, UserTag, CustomTag, MenuPhoto, PriceLevel } from '../../types';

interface Props {
  business: Business;
  ratingData: UseBusinessRatingReturn;
  // PriceLevel
  priceLevels: PriceLevel[];
  onPriceLevelChange: () => void;
  // Tags
  seedTags: string[];
  userTags: UserTag[];
  customTags: CustomTag[];
  onTagsChange: () => void;
  // MenuPhoto
  menuPhoto: MenuPhoto | null;
  onPhotoChange: () => void;
  isLoading: boolean;
}

export default memo(function InfoTab({
  business,
  ratingData,
  priceLevels,
  onPriceLevelChange,
  seedTags,
  userTags,
  customTags,
  onTagsChange,
  menuPhoto,
  onPhotoChange,
  isLoading,
}: Props) {
  return (
    <Box sx={{ px: 2, pb: 2 }}>
      <CriteriaSection
        criteriaAverages={ratingData.criteriaAverages}
        myCriteria={ratingData.myCriteria}
        myRating={ratingData.myRating}
        hasCriteriaData={ratingData.hasCriteriaData}
        onCriterionRate={ratingData.handleCriterionRate}
      />
      <Divider sx={{ my: 1.5 }} />
      <BusinessPriceLevel
        key={business.id}
        businessId={business.id}
        businessName={business.name}
        priceLevels={priceLevels}
        isLoading={isLoading}
        onPriceLevelChange={onPriceLevelChange}
      />
      <Divider sx={{ my: 1.5 }} />
      <BusinessTags
        businessId={business.id}
        businessName={business.name}
        seedTags={seedTags}
        userTags={userTags}
        customTags={customTags}
        isLoading={isLoading}
        onTagsChange={onTagsChange}
      />
      <Divider sx={{ my: 1.5 }} />
      <MenuPhotoSection
        menuPhoto={menuPhoto}
        businessId={business.id}
        isLoading={isLoading}
        onPhotoChange={onPhotoChange}
      />
    </Box>
  );
});
