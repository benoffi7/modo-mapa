import { useState, memo } from 'react';
import { Box, Typography, Rating, Collapse, Chip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RestaurantOutlinedIcon from '@mui/icons-material/RestaurantOutlined';
import EmojiPeopleOutlinedIcon from '@mui/icons-material/EmojiPeopleOutlined';
import AttachMoneyOutlinedIcon from '@mui/icons-material/AttachMoneyOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import { useAuth } from '../../context/AuthContext';
import { RATING_CRITERIA } from '../../constants/criteria';
import type { RatingCriteria, RatingCriterionId } from '../../types';
import type { CriteriaAverages } from '../../hooks/useBusinessRating';
import type { SvgIconComponent } from '@mui/icons-material';

const CRITERION_ICONS: Record<RatingCriterionId, SvgIconComponent> = {
  food: RestaurantOutlinedIcon,
  service: EmojiPeopleOutlinedIcon,
  price: AttachMoneyOutlinedIcon,
  ambiance: HomeOutlinedIcon,
  speed: BoltOutlinedIcon,
};

interface Props {
  criteriaAverages: CriteriaAverages;
  myCriteria: RatingCriteria;
  myRating: number | null;
  hasCriteriaData: boolean;
  onCriterionRate: (criterionId: RatingCriterionId, value: number | null) => void;
}

export default memo(function CriteriaSection({ criteriaAverages, myCriteria, myRating, hasCriteriaData, onCriterionRate }: Props) {
  const { user } = useAuth();
  const [criteriaOpen, setCriteriaOpen] = useState(false);

  if (!hasCriteriaData && !user) return null;

  return (
    <Box sx={{ mt: 1 }}>
      <Chip
        label={criteriaOpen ? 'Ocultar detalle' : 'Detalle por criterio'}
        size="small"
        variant="outlined"
        onClick={() => setCriteriaOpen((prev) => !prev)}
        icon={criteriaOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ fontSize: '0.75rem', borderRadius: 1 }}
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
                Tu calificación por criterio{!myRating ? ' (calificá primero con estrellas)' : ':'}
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
                      onChange={(_, value) => onCriterionRate(criterion.id, value)}
                      size="small"
                      sx={{ fontSize: 16 }}
                      disabled={!myRating}
                    />
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
});
