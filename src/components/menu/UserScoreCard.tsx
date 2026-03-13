import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { ACTION_LABELS } from '../../constants/rankings';
import type { UserRankingEntry } from '../../types';

interface Props {
  entry: UserRankingEntry | undefined;
  position: number | undefined;
  isLive?: boolean;
}

export default function UserScoreCard({ entry, position, isLive }: Props) {
  if (!entry) {
    return null;
  }

  return (
    <Card variant="outlined" sx={{ mx: 2, mb: 2, p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Tu actividad
        </Typography>
        {position != null && (
          <Chip label={`#${position}`} size="small" color="primary" variant="outlined" />
        )}
        {isLive && (
          <Typography variant="caption" color="text.secondary">
            (en vivo)
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {(Object.entries(ACTION_LABELS) as Array<[keyof UserRankingEntry['breakdown'], string]>).map(
          ([key, label]) => (
            <Chip
              key={key}
              label={`${label}: ${entry.breakdown[key]}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          ),
        )}
      </Box>

      <Typography variant="body2" sx={{ mt: 1, fontWeight: 600, textAlign: 'right' }}>
        Total: {entry.score} pts
      </Typography>
    </Card>
  );
}
