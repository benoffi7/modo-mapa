import { useState } from 'react';
import {
  Box, Typography, Card, CardActionArea,
  LinearProgress, Dialog, DialogTitle, DialogContent, IconButton,
} from '@mui/material';
import type { SvgIconProps } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import FlightOutlinedIcon from '@mui/icons-material/FlightOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { useMyCheckIns } from '../../hooks/useMyCheckIns';
import { ACHIEVEMENT_DEFINITIONS } from '../../constants/achievements';

const ACHIEVEMENT_ICONS: Record<string, React.ComponentType<SvgIconProps>> = {
  ExploreOutlined: ExploreOutlinedIcon,
  PeopleOutlined: PeopleOutlinedIcon,
  RateReviewOutlined: RateReviewOutlinedIcon,
  FlightOutlined: FlightOutlinedIcon,
  BookmarkBorder: BookmarkBorderIcon,
  CameraAltOutlined: CameraAltOutlinedIcon,
  EmojiEventsOutlined: EmojiEventsOutlinedIcon,
  LocalFireDepartment: LocalFireDepartmentIcon,
};

interface Achievement {
  id: string;
  label: string;
  description: string;
  icon: React.ReactElement;
  current: number;
  target: number;
}

export default function AchievementsGrid() {
  const { stats } = useMyCheckIns();
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

  const resolveProgress = (id: string): number => {
    if (id === 'explorador') return stats.uniqueBusinesses;
    return 0;
  };

  // Full list — will be replaced by Firestore data + Cloud Function progress
  const achievements: Achievement[] = ACHIEVEMENT_DEFINITIONS.map((def) => {
    const Icon = ACHIEVEMENT_ICONS[def.icon];
    return {
      ...def,
      icon: <Icon color={def.iconColor} />,
      current: resolveProgress(def.id),
    };
  });

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
        {achievements.map((a) => {
          const pct = Math.min(100, Math.round((a.current / a.target) * 100));
          const completed = pct >= 100;
          return (
            <Card
              key={a.id}
              variant="outlined"
              sx={{ opacity: completed ? 1 : 0.8 }}
            >
              <CardActionArea onClick={() => setSelectedAchievement(a)} sx={{ p: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  {a.icon}
                  <Typography variant="subtitle2" fontWeight={600}>{a.label}</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{ borderRadius: 1, height: 6, mb: 0.5 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {a.current}/{a.target} ({pct}%)
                </Typography>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>

      <Dialog
        open={selectedAchievement !== null}
        onClose={() => setSelectedAchievement(null)}
        maxWidth="xs"
        fullWidth
      >
        {selectedAchievement && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedAchievement.icon}
                {selectedAchievement.label}
              </Box>
              <IconButton size="small" onClick={() => setSelectedAchievement(null)}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {selectedAchievement.description}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.round((selectedAchievement.current / selectedAchievement.target) * 100))}
                sx={{ borderRadius: 1, height: 8, mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                Progreso: {selectedAchievement.current}/{selectedAchievement.target}
              </Typography>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}
