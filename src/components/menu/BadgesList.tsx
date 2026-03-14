import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { BadgeDefinition } from '../../constants/badges';

interface Props {
  badges: BadgeDefinition[];
  compact?: boolean;
}

export default function BadgesList({ badges, compact = false }: Props) {
  if (badges.length === 0) return null;

  if (compact) {
    return (
      <Box sx={{ display: 'flex', gap: 0.25, flexWrap: 'wrap' }}>
        {badges.map((b) => (
          <Tooltip key={b.id} title={`${b.name}: ${b.description}`}>
            <Typography component="span" sx={{ fontSize: '0.85rem', cursor: 'default' }}>
              {b.icon}
            </Typography>
          </Tooltip>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {badges.map((b) => (
        <Tooltip key={b.id} title={b.description}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.25,
              bgcolor: 'action.hover',
              borderRadius: 1,
            }}
          >
            <Typography component="span" sx={{ fontSize: '0.85rem' }}>
              {b.icon}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              {b.name}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}
