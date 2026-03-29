import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import { ACTION_LABELS, SCORING, getUserTier } from '../../constants/rankings';
import { evaluateBadges } from '../../constants/badges';
import BadgesList from './BadgesList';
import type { UserRankingEntry } from '../../types';

interface Props {
  entry: UserRankingEntry | null;
  position: number | null;
  onClose: () => void;
}

export default function UserProfileModal({ entry, position, onClose }: Props) {
  const badges = useMemo(
    () => entry ? evaluateBadges(entry.breakdown, { position: position ?? undefined }) : [],
    [entry, position],
  );

  if (!entry) return null;

  const tier = getUserTier(entry.score);
  const maxContribution = Math.max(
    ...Object.keys(SCORING).map(
      (k) => entry.breakdown[k as keyof typeof entry.breakdown] * SCORING[k as keyof typeof SCORING],
    ),
    1,
  );

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 0 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {entry.displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {tier.icon} {tier.name}
            {position != null && ` · #${position}`}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Cerrar">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          Desglose de actividad
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {(Object.entries(ACTION_LABELS) as Array<[keyof UserRankingEntry['breakdown'], string]>).map(
            ([key, label]) => {
              const count = entry.breakdown[key];
              const points = count * SCORING[key];
              const pct = maxContribution > 0 ? (points / maxContribution) * 100 : 0;

              return (
                <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ minWidth: 90, color: 'text.secondary' }}>
                    {label}
                  </Typography>
                  <Box sx={{ flex: 1, height: 12, bgcolor: 'action.hover', borderRadius: 1, position: 'relative' }}>
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        width: `${pct}%`,
                        bgcolor: 'primary.main',
                        borderRadius: 1,
                        minWidth: count > 0 ? 4 : 0,
                      }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ minWidth: 28, textAlign: 'right', fontWeight: 600 }}>
                    {count}
                  </Typography>
                </Box>
              );
            },
          )}
        </Box>

        {/* Badges */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Logros
          </Typography>
          <BadgesList badges={badges} />
          {badges.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              Aún no tiene logros
            </Typography>
          )}
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center', mt: 2 }}>
          {entry.score} pts
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
