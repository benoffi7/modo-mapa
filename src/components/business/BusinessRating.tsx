import { useMemo, useState, memo } from 'react';
import { Box, Typography, Rating, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../context/AuthContext';
import { upsertRating, deleteRating } from '../../services/ratings';
import type { Rating as RatingType } from '../../types';

interface Props {
  businessId: string;
  ratings: RatingType[];
  isLoading: boolean;
  onRatingChange: () => void;
}

export default memo(function BusinessRating({ businessId, ratings, isLoading, onRatingChange }: Props) {
  const { user } = useAuth();

  const { averageRating, totalRatings, serverMyRating } = useMemo(() => {
    let sum = 0;
    let myScore: number | null = null;
    for (const r of ratings) {
      sum += r.score;
      if (user && r.userId === user.uid) {
        myScore = r.score;
      }
    }
    return {
      averageRating: ratings.length > 0 ? sum / ratings.length : 0,
      totalRatings: ratings.length,
      serverMyRating: myScore,
    };
  }, [ratings, user]);

  // Optimistic rating: 1-5 = pending score, 0 = pending delete, null = no pending change.
  // Never cleared automatically — resets when component unmounts (business sheet closes).
  const [pendingRating, setPendingRating] = useState<number | null>(null);

  const myRating = pendingRating === 0 ? null : (pendingRating ?? serverMyRating);

  const handleRate = async (_: unknown, value: number | null) => {
    if (!user || !value) return;
    setPendingRating(value);
    try {
      await upsertRating(user.uid, businessId, value);
      onRatingChange();
    } catch {
      setPendingRating(null);
    }
  };

  const handleDeleteRating = async () => {
    if (!user) return;
    setPendingRating(0);
    try {
      await deleteRating(user.uid, businessId);
      onRatingChange();
    } catch {
      setPendingRating(null);
    }
  };

  if (!isLoading && ratings.length === 0 && !user) {
    return (
      <Box sx={{ py: 1 }}>
        <Typography variant="body2" color="text.secondary">Sin calificaciones aún</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
          {averageRating > 0 ? averageRating.toFixed(1) : '\u2014'}
        </Typography>
        <Rating value={averageRating} precision={0.1} readOnly size="small" />
        <Typography variant="body2">
          ({totalRatings} {totalRatings === 1 ? 'opinión' : 'opiniones'})
        </Typography>
      </Box>
      {user && (
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
            <IconButton size="small" onClick={handleDeleteRating} sx={{ color: 'text.secondary', p: 0.25 }} aria-label="Borrar calificación">
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      )}
    </Box>
  );
});
