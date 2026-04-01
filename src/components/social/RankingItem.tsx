import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import { MEDALS, getUserTier } from '../../constants/rankings';
import type { UserRankingEntry } from '../../types';

interface Props {
  entry: UserRankingEntry;
  position: number;
  maxScore: number;
  isCurrentUser: boolean;
  /** Stagger index for entrance animation */
  animationIndex?: number;
  /** Position change vs previous period (positive = moved up) */
  positionChange?: number | undefined;
  onClick?: () => void;
}

function TrendIndicator({ change }: { change: number | undefined }) {
  if (change == null || change === 0) return null;
  const up = change > 0;
  return (
    <Typography
      component="span"
      variant="caption"
      sx={{ fontWeight: 600, color: up ? 'success.main' : 'error.main', fontSize: '0.65rem', ml: 0.5 }}
    >
      {up ? `▲${change}` : `▼${Math.abs(change)}`}
    </Typography>
  );
}

export default function RankingItem({ entry, position, maxScore, isCurrentUser, animationIndex = 0, positionChange, onClick }: Props) {
  const medal = MEDALS[position] ?? '';
  const progress = maxScore > 0 ? (entry.score / maxScore) * 100 : 0;
  const tier = getUserTier(entry.score);

  return (
    <Box
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      aria-label={onClick ? `Ver perfil de ${entry.displayName}` : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: isCurrentUser ? 'action.selected' : 'transparent',
        borderRadius: 1,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { bgcolor: 'action.hover' } : {},
        opacity: 0,
        animation: 'rankingFadeIn 0.3s ease forwards',
        animationDelay: `${animationIndex * 50}ms`,
        '@keyframes rankingFadeIn': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
          opacity: 1,
        },
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, minWidth: 28, textAlign: 'center' }}
      >
        {medal || `#${position}`}
      </Typography>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: isCurrentUser ? 600 : 400 }}>
            {entry.displayName}
          </Typography>
          <Typography component="span" sx={{ fontSize: '0.75rem', lineHeight: 1 }} title={tier.name}>
            {tier.icon}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          {entry.score}
        </Typography>
        <TrendIndicator change={positionChange} />
      </Box>
    </Box>
  );
}
