import { Box, Card, CardActionArea, Typography, LinearProgress } from '@mui/material';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import FlightOutlinedIcon from '@mui/icons-material/FlightOutlined';
import { useMyCheckIns } from '../../hooks/useMyCheckIns';

interface Achievement {
  id: string;
  label: string;
  icon: React.ReactElement;
  current: number;
  target: number;
}

interface Props {
  onViewAll: () => void;
}

export default function AchievementsSection({ onViewAll }: Props) {
  const { stats } = useMyCheckIns();

  // Hardcoded default achievements — will be replaced by Firestore data
  const achievements: Achievement[] = [
    { id: 'explorador', label: 'Explorador', icon: <ExploreOutlinedIcon color="success" />, current: stats.uniqueBusinesses, target: 10 },
    { id: 'social', label: 'Social', icon: <PeopleOutlinedIcon color="info" />, current: 0, target: 5 },
    { id: 'critico', label: 'Critico', icon: <RateReviewOutlinedIcon color="warning" />, current: 0, target: 10 },
    { id: 'viajero', label: 'Viajero', icon: <FlightOutlinedIcon color="secondary" />, current: 0, target: 3 },
  ];

  const sorted = [...achievements].sort((a, b) => (b.current / b.target) - (a.current / a.target));

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">Logros</Typography>
        <Typography
          variant="caption"
          color="primary"
          onClick={onViewAll}
          sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
        >
          Ver todos
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, overflow: 'auto', pb: 0.5 }}>
        {sorted.map((a) => {
          const pct = Math.min(100, Math.round((a.current / a.target) * 100));
          return (
            <Card key={a.id} variant="outlined" sx={{ minWidth: 120, maxWidth: 140, flexShrink: 0 }}>
              <CardActionArea onClick={onViewAll} sx={{ p: 1.5, textAlign: 'center' }}>
                {a.icon}
                <Typography variant="caption" fontWeight={600} display="block" sx={{ mt: 0.5 }}>
                  {a.label}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{ mt: 0.5, borderRadius: 1, height: 6 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {pct}%
                </Typography>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
