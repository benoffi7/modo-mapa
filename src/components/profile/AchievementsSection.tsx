import { Box, Card, CardActionArea, Typography, LinearProgress } from '@mui/material';
import type { SvgIconProps } from '@mui/material';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import FlightOutlinedIcon from '@mui/icons-material/FlightOutlined';
import { useMyCheckIns } from '../../hooks/useMyCheckIns';
import { ACHIEVEMENT_DEFINITIONS } from '../../constants/achievements';

const ACHIEVEMENT_ICONS: Record<string, React.ComponentType<SvgIconProps>> = {
  ExploreOutlined: ExploreOutlinedIcon,
  PeopleOutlined: PeopleOutlinedIcon,
  RateReviewOutlined: RateReviewOutlinedIcon,
  FlightOutlined: FlightOutlinedIcon,
};

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

  const resolveProgress = (id: string): number => {
    if (id === 'explorador') return stats.uniqueBusinesses;
    return 0;
  };

  // First 4 achievements — will be replaced by Firestore data
  const achievements: Achievement[] = ACHIEVEMENT_DEFINITIONS.slice(0, 4).map((def) => {
    const Icon = ACHIEVEMENT_ICONS[def.icon];
    return {
      ...def,
      icon: <Icon color={def.iconColor} />,
      current: resolveProgress(def.id),
    };
  });

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
