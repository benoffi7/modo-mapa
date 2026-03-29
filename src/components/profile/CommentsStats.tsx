import { useState } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { truncate } from '../../utils/text';
import type { Business } from '../../types';

interface StatsData {
  total: number;
  totalLikes: number;
  avgLikes: number;
  mostPopular: { business: Business | null } | null;
}

interface Props {
  stats: StatsData;
}

export default function CommentsStats({ stats }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box sx={{ mx: 2, mb: 1 }}>
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label="Resumen de comentarios"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); }
        }}
        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', py: 0.5 }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          Resumen
        </Typography>
        {expanded ? <ExpandLessIcon fontSize="small" color="action" /> : <ExpandMoreIcon fontSize="small" color="action" />}
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, pb: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Comentarios</Typography>
            <Typography variant="body2" fontWeight={600}>{stats.total}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Likes recibidos</Typography>
            <Typography variant="body2" fontWeight={600}>{stats.totalLikes}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Promedio likes</Typography>
            <Typography variant="body2" fontWeight={600}>{stats.avgLikes.toFixed(1)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Más popular</Typography>
            <Typography variant="body2" fontWeight={600}>
              {truncate(stats.mostPopular?.business?.name ?? '—', 20)}
            </Typography>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}
