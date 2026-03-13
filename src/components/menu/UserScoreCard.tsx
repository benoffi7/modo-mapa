import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import type { UserRankingEntry } from '../../types';

const ACTION_LABELS: Record<keyof UserRankingEntry['breakdown'], string> = {
  comments: 'Comentarios',
  ratings: 'Calificaciones',
  likes: 'Likes',
  tags: 'Etiquetas',
  favorites: 'Favoritos',
  photos: 'Fotos',
};

interface Props {
  entry: UserRankingEntry | undefined;
  position: number | undefined;
}

export default function UserScoreCard({ entry, position }: Props) {
  if (!entry) {
    return (
      <Card variant="outlined" sx={{ mx: 2, mb: 2, p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No apareces en el ranking de este periodo.
        </Typography>
      </Card>
    );
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
