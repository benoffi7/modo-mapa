import { memo } from 'react';
import { Box, Divider } from '@mui/material';
import CriteriaSection from './CriteriaSection';
import BusinessPriceLevel from './BusinessPriceLevel';
import BusinessTags from './BusinessTags';
import MenuPhotoSection from './MenuPhotoSection';
import type { UseBusinessRatingReturn } from '../../hooks/useBusinessRating';
import type { UserTag, CustomTag, MenuPhoto, PriceLevel } from '../../types';

export interface PriceLevelData {
  levels: PriceLevel[];
  onChange: () => void;
}

export interface TagsData {
  seed: string[];
  user: UserTag[];
  custom: CustomTag[];
  onChange: () => void;
}

export interface PhotoData {
  photo: MenuPhoto | null;
  onChange: () => void;
}

interface Props {
  ratingData: UseBusinessRatingReturn;
  priceLevelData: PriceLevelData;
  tagsData: TagsData;
  photoData: PhotoData;
  isLoading: boolean;
}

export default memo(function InfoTab({
  ratingData,
  priceLevelData,
  tagsData,
  photoData,
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
        priceLevels={priceLevelData.levels}
        isLoading={isLoading}
        onPriceLevelChange={priceLevelData.onChange}
      />
      <Divider sx={{ my: 1.5 }} />
      <BusinessTags
        seedTags={tagsData.seed}
        userTags={tagsData.user}
        customTags={tagsData.custom}
        isLoading={isLoading}
        onTagsChange={tagsData.onChange}
      />
      <Divider sx={{ my: 1.5 }} />
      <MenuPhotoSection
        menuPhoto={photoData.photo}
        isLoading={isLoading}
        onPhotoChange={photoData.onChange}
      />
    </Box>
  );
});
