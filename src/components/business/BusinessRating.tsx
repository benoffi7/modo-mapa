import { memo } from 'react';
import { Box, Typography, Rating, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../context/AuthContext';
import { MSG_BUSINESS } from '../../constants/messages';
import type { UseBusinessRatingReturn } from '../../hooks/useBusinessRating';
import type { Rating as RatingType } from '../../types';

interface Props {
  ratingData: UseBusinessRatingReturn;
  ratings: RatingType[];
  isLoading: boolean;
  readOnly?: boolean;
}

export default memo(function BusinessRating({ ratingData, ratings, isLoading, readOnly = false }: Props) {
  const { user } = useAuth();
  const { averageRating, totalRatings, myRating, handleRate, handleDeleteRating } = ratingData;

  if (!isLoading && ratings.length === 0 && !user) {
    return (
      <Box sx={{ py: 1 }}>
        <Typography variant="body2" color="text.secondary">{MSG_BUSINESS.emptyRatings}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
          {averageRating > 0 ? averageRating.toFixed(1) : '—'}
        </Typography>
        <Rating value={averageRating} precision={0.1} readOnly size="small" />
        <Typography variant="body2">
          ({totalRatings} {totalRatings === 1 ? 'opinión' : 'opiniones'})
        </Typography>
      </Box>
      {!readOnly && user && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Tu calificación:
          </Typography>
          <Rating
            value={myRating}
            onChange={handleRate}
            size="medium"
          />
          {myRating != null && (
            <IconButton size="small" onClick={handleDeleteRating} sx={{ color: 'text.secondary', minWidth: 44, minHeight: 44 }} aria-label="Borrar calificación">
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      )}
    </Box>
  );
});
