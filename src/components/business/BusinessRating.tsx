import { useMemo, useState, useCallback, memo } from 'react';
import { Box, Typography, Rating, IconButton, Collapse, Chip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RestaurantOutlinedIcon from '@mui/icons-material/RestaurantOutlined';
import EmojiPeopleOutlinedIcon from '@mui/icons-material/EmojiPeopleOutlined';
import AttachMoneyOutlinedIcon from '@mui/icons-material/AttachMoneyOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import { useAuth } from '../../context/AuthContext';
import { upsertRating, deleteRating, upsertCriteriaRating } from '../../services/ratings';
import { RATING_CRITERIA } from '../../constants/criteria';
import type { Rating as RatingType, RatingCriteria, RatingCriterionId } from '../../types';
import type { SvgIconComponent } from '@mui/icons-material';

const CRITERION_ICONS: Record<RatingCriterionId, SvgIconComponent> = {
  food: RestaurantOutlinedIcon,
  service: EmojiPeopleOutlinedIcon,
  price: AttachMoneyOutlinedIcon,
  ambiance: HomeOutlinedIcon,
  speed: BoltOutlinedIcon,
};

interface Props {
  businessId: string;
  ratings: RatingType[];
  isLoading: boolean;
  onRatingChange: () => void;
}

interface CriteriaAverages {
  [key: string]: { sum: number; count: number; avg: number };
}

export default memo(function BusinessRating({ businessId, ratings, isLoading, onRatingChange }: Props) {
  const { user } = useAuth();
  const [criteriaOpen, setCriteriaOpen] = useState(false);

  const { averageRating, totalRatings, serverMyRating, serverMyCriteria, criteriaAverages } = useMemo(() => {
    let sum = 0;
    let myScore: number | null = null;
    let myCriteria: RatingCriteria | undefined;
    const critAgg: CriteriaAverages = {};

    for (const criterion of RATING_CRITERIA) {
      critAgg[criterion.id] = { sum: 0, count: 0, avg: 0 };
    }

    for (const r of ratings) {
      sum += r.score;
      if (user && r.userId === user.uid) {
        myScore = r.score;
        myCriteria = r.criteria;
      }
      if (r.criteria) {
        for (const criterion of RATING_CRITERIA) {
          const value = r.criteria[criterion.id];
          if (value != null) {
            critAgg[criterion.id].sum += value;
            critAgg[criterion.id].count += 1;
          }
        }
      }
    }

    // Calculate averages
    for (const key of Object.keys(critAgg)) {
      const entry = critAgg[key];
      entry.avg = entry.count > 0 ? entry.sum / entry.count : 0;
    }

    return {
      averageRating: ratings.length > 0 ? sum / ratings.length : 0,
      totalRatings: ratings.length,
      serverMyRating: myScore,
      serverMyCriteria: myCriteria,
      criteriaAverages: critAgg,
    };
  }, [ratings, user]);

  // Optimistic rating: 1-5 = pending score, 0 = pending delete, null = no pending change.
  // Never cleared automatically — resets when component unmounts (business sheet closes).
  const [pendingRating, setPendingRating] = useState<number | null>(null);
  const [pendingCriteria, setPendingCriteria] = useState<RatingCriteria | null>(null);

  const myRating = pendingRating === 0 ? null : (pendingRating ?? serverMyRating);
  const myCriteria: RatingCriteria = { ...(serverMyCriteria ?? {}), ...(pendingCriteria ?? {}) };

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
    setPendingCriteria(null);
    try {
      await deleteRating(user.uid, businessId);
      onRatingChange();
    } catch {
      setPendingRating(null);
    }
  };

  const handleCriterionRate = useCallback(async (criterionId: RatingCriterionId, value: number | null) => {
    if (!user || !value) return;
    setPendingCriteria((prev) => ({ ...(prev ?? {}), [criterionId]: value }));
    try {
      await upsertCriteriaRating(user.uid, businessId, { [criterionId]: value });
      onRatingChange();
    } catch {
      setPendingCriteria((prev) => {
        if (!prev) return null;
        const next = { ...prev };
        delete next[criterionId];
        return Object.keys(next).length > 0 ? next : null;
      });
    }
  }, [user, businessId, onRatingChange]);

  const hasCriteriaData = Object.values(criteriaAverages).some((c) => c.count > 0);

  if (!isLoading && ratings.length === 0 && !user) {
    return (
      <Box sx={{ py: 1 }}>
        <Typography variant="body2" color="text.secondary">Sin calificaciones a\u00fan</Typography>
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
          ({totalRatings} {totalRatings === 1 ? 'opini\u00f3n' : 'opiniones'})
        </Typography>
      </Box>
      {user && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Tu calificaci\u00f3n:
          </Typography>
          <Rating
            value={myRating}
            onChange={handleRate}
            size="medium"
          />
          {myRating != null && (
            <IconButton size="small" onClick={handleDeleteRating} sx={{ color: 'text.secondary', p: 0.25 }} aria-label="Borrar calificaci\u00f3n">
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      )}

      {/* Criteria section toggle */}
      {(hasCriteriaData || user) && (
        <Box sx={{ mt: 1 }}>
          <Chip
            label={criteriaOpen ? 'Ocultar detalle' : 'Detalle por criterio'}
            size="small"
            variant="outlined"
            onClick={() => setCriteriaOpen((prev) => !prev)}
            icon={criteriaOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ fontSize: '0.75rem' }}
          />
          <Collapse in={criteriaOpen}>
            <Box sx={{ mt: 1.5 }}>
              {/* Criteria averages */}
              {hasCriteriaData && (
                <Box sx={{ mb: 1.5 }}>
                  {RATING_CRITERIA.map((criterion) => {
                    const Icon = CRITERION_ICONS[criterion.id];
                    const agg = criteriaAverages[criterion.id];
                    if (agg.count === 0) return null;
                    return (
                      <Box key={criterion.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                        <Icon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ width: 72, fontSize: '0.8rem' }}>
                          {criterion.label}
                        </Typography>
                        <Rating value={agg.avg} precision={0.1} readOnly size="small" sx={{ fontSize: 16 }} />
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary', minWidth: 24 }}>
                          {agg.avg.toFixed(1)}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}

              {/* User's criteria ratings */}
              {user && (
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, fontSize: '0.8rem' }}>
                    Tu calificaci\u00f3n por criterio:
                  </Typography>
                  {RATING_CRITERIA.map((criterion) => {
                    const Icon = CRITERION_ICONS[criterion.id];
                    const myValue = myCriteria[criterion.id] ?? null;
                    return (
                      <Box key={criterion.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                        <Icon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ width: 72, fontSize: '0.8rem' }}>
                          {criterion.label}
                        </Typography>
                        <Rating
                          value={myValue}
                          onChange={(_, value) => handleCriterionRate(criterion.id, value)}
                          size="small"
                          sx={{ fontSize: 16 }}
                        />
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  );
});
