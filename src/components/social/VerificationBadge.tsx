import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { trackEvent } from '../../utils/analytics';
import type { VerificationBadge as VerificationBadgeType } from '../../types';

interface Props {
  badge: VerificationBadgeType;
  compact?: boolean;
}

// Brand color (medalla de oro) — usado como border y bar del LinearProgress.
const GOLD_HEX = '#FFD700';
const GREY_BORDER = 'divider';

export default function VerificationBadge({ badge, compact = false }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  // Duplicamos la opacidad en dark (0.08 -> 0.16) para compensar el background.default oscuro
  const goldBg = alpha(GOLD_HEX, isDark ? 0.16 : 0.08);

  const tooltipText = `${badge.name}: ${badge.current}/${badge.target} \u2014 ${badge.description}`;

  const handleTooltipOpen = () => {
    trackEvent('verification_badge_tooltip', { badge_id: badge.id });
  };

  if (compact) {
    return (
      <Tooltip title={tooltipText} onOpen={handleTooltipOpen}>
        <Chip
          label={`${badge.icon} ${badge.name}`}
          size="small"
          variant={badge.earned ? 'filled' : 'outlined'}
          sx={{
            fontSize: '0.75rem',
            height: 24,
            borderColor: badge.earned ? GOLD_HEX : undefined,
            bgcolor: badge.earned ? goldBg : undefined,
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={tooltipText} onOpen={handleTooltipOpen}>
      <Box
        sx={{
          p: 1.5,
          borderRadius: 1,
          border: 1,
          borderColor: badge.earned ? GOLD_HEX : GREY_BORDER,
          bgcolor: badge.earned ? goldBg : 'transparent',
          minWidth: 140,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
          <Typography component="span" sx={{ fontSize: '1.25rem' }}>
            {badge.icon}
          </Typography>
          <Typography variant="subtitle2" fontWeight={600}>
            {badge.name}
          </Typography>
        </Box>

        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
          {badge.description}
        </Typography>

        <LinearProgress
          variant="determinate"
          value={badge.progress}
          sx={{
            borderRadius: 1,
            height: 6,
            mb: 0.5,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': {
              bgcolor: badge.earned ? GOLD_HEX : 'primary.main',
            },
          }}
        />

        <Typography variant="caption" color="text.secondary">
          {badge.id === 'trusted_reviewer'
            ? `${badge.current}% consistencia`
            : `${badge.current}/${badge.target}`}
          {badge.earned && ' \u2714'}
        </Typography>
      </Box>
    </Tooltip>
  );
}
