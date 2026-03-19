import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Collapse,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useToast } from '../../context/ToastContext';
import type { SvgIconComponent } from '@mui/icons-material';

const DISMISSED_KEY = 'onboarding_dismissed';
const RANKING_VIEWED_KEY = 'onboarding_ranking_viewed';

interface Task {
  id: string;
  label: string;
  icon: SvgIconComponent;
  isComplete: boolean;
}

interface Props {
  menuOpen?: boolean;
}

export default function OnboardingChecklist({ menuOpen }: Props) {
  const { user, displayName } = useAuth();
  const { profile, refetch } = useUserProfile(user?.uid ?? null, displayName ?? undefined);

  // Refetch profile each time the side menu opens
  const prevOpen = useRef(menuOpen);
  useEffect(() => {
    if (menuOpen && !prevOpen.current) refetch();
    prevOpen.current = menuOpen;
  }, [menuOpen, refetch]);
  const toast = useToast();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === 'true');
  const [expanded, setExpanded] = useState(() => localStorage.getItem('onboarding_expanded') !== 'false');

  const tasks: Task[] = useMemo(() => [
    {
      id: 'rating',
      label: 'Calific\u00e1 tu primer comercio',
      icon: StarOutlineIcon,
      isComplete: (profile?.stats.ratings ?? 0) >= 1,
    },
    {
      id: 'comment',
      label: 'Dej\u00e1 un comentario',
      icon: ChatBubbleOutlineIcon,
      isComplete: (profile?.stats.comments ?? 0) >= 1,
    },
    {
      id: 'favorite',
      label: 'Guard\u00e1 un favorito',
      icon: FavoriteBorderIcon,
      isComplete: (profile?.stats.favorites ?? 0) >= 1,
    },
    {
      id: 'tag',
      label: 'Agreg\u00e1 un tag',
      icon: LabelOutlinedIcon,
      isComplete: (profile?.stats.customTags ?? 0) >= 1,
    },
    {
      id: 'ranking',
      label: 'Explor\u00e1 el ranking',
      icon: EmojiEventsOutlinedIcon,
      isComplete: localStorage.getItem(RANKING_VIEWED_KEY) === 'true',
    },
  ], [profile]);

  const completed = tasks.filter((t) => t.isComplete).length;
  const allDone = completed === tasks.length;

  // Show celebration toast when all complete
  const [celebrated, setCelebrated] = useState(() => localStorage.getItem('onboarding_celebrated') === 'true');
  if (allDone && !celebrated) {
    setCelebrated(true);
    localStorage.setItem('onboarding_celebrated', 'true');
    // Use setTimeout to avoid setState during render issues with toast
    setTimeout(() => toast.success('\u00a1Completaste todos los primeros pasos!'), 0);
  }

  if (dismissed || allDone || !profile) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem('onboarding_expanded', String(next));
  };

  return (
    <Card variant="outlined" sx={{ mx: 2, mb: 1, borderRadius: 2 }}>
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={toggleExpanded}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
              Primeros pasos
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {completed}/{tasks.length}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <IconButton size="small" sx={{ p: 0.25 }} aria-label={expanded ? 'Colapsar' : 'Expandir'}>
              {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
              aria-label="Cerrar primeros pasos"
              sx={{ p: 0.25 }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>
        <LinearProgress
          variant="determinate"
          value={(completed / tasks.length) * 100}
          sx={{ mt: 0.5, borderRadius: 1, height: 6 }}
        />
        <Collapse in={expanded}>
          <List disablePadding dense sx={{ mt: 0.5 }}>
            {tasks.map((task) => (
              <ListItem key={task.id} disablePadding sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  {task.isComplete ? (
                    <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                  ) : (
                    <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={task.label}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontSize: '0.8rem',
                    sx: task.isComplete ? { textDecoration: 'line-through', color: 'text.disabled' } : undefined,
                  }}
                />
                <task.icon sx={{ fontSize: 16, color: task.isComplete ? 'text.disabled' : 'text.secondary' }} />
              </ListItem>
            ))}
          </List>
        </Collapse>
      </CardContent>
    </Card>
  );
}
