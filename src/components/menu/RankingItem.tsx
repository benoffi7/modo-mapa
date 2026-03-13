import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import { MEDALS } from '../../constants/rankings';
import type { UserRankingEntry } from '../../types';

interface Props {
  entry: UserRankingEntry;
  position: number;
  maxScore: number;
  isCurrentUser: boolean;
}

export default function RankingItem({ entry, position, maxScore, isCurrentUser }: Props) {
  const medal = MEDALS[position] ?? '';
  const progress = maxScore > 0 ? (entry.score / maxScore) * 100 : 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: isCurrentUser ? 'action.selected' : 'transparent',
        borderRadius: 1,
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, minWidth: 28, textAlign: 'center' }}
      >
        {medal || `#${position}`}
      </Typography>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: isCurrentUser ? 600 : 400 }}>
          {entry.displayName}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
        />
      </Box>

      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
        {entry.score}
      </Typography>
    </Box>
  );
}
