import { useState, useEffect } from 'react';
import { Box, Typography, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StarIcon from '@mui/icons-material/Star';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ExploreIcon from '@mui/icons-material/Explore';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import FavoriteIcon from '@mui/icons-material/Favorite';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { trackEvent } from '../../utils/analytics';

interface Special {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  type: string;
  referenceId: string;
  order: number;
  active: boolean;
}

const ICON_MAP: Record<string, React.ReactElement> = {
  LocalFireDepartment: <LocalFireDepartmentIcon color="error" />,
  Star: <StarIcon color="warning" />,
  TrendingUp: <TrendingUpIcon color="success" />,
  Explore: <ExploreIcon color="primary" />,
  Restaurant: <RestaurantIcon color="info" />,
  Favorite: <FavoriteIcon color="error" />,
  EmojiEvents: <EmojiEventsIcon color="warning" />,
  NewReleases: <NewReleasesIcon color="secondary" />,
};

const FALLBACK_SPECIALS: Special[] = [
  { id: '1', title: 'Trending esta semana', subtitle: 'Los comercios mas populares', icon: 'LocalFireDepartment', type: 'trending', referenceId: '', order: 0, active: true },
  { id: '2', title: 'Mejor calificados', subtitle: 'Top 10 por rating', icon: 'Star', type: 'trending', referenceId: '', order: 1, active: true },
  { id: '3', title: 'En crecimiento', subtitle: 'Nuevos favoritos de la comunidad', icon: 'TrendingUp', type: 'trending', referenceId: '', order: 2, active: true },
];

export default function SpecialsSection() {
  const [specials, setSpecials] = useState<Special[]>(FALLBACK_SPECIALS);
  useEffect(() => {
    getDocs(query(collection(db, 'specials'), where('active', '==', true), orderBy('order')))
      .then((snap) => {
        if (snap.size > 0) {
          setSpecials(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Special)));
        }
      })
      .catch(() => { /* use fallback */ });
  }, []);

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
        Especiales
      </Typography>
      <List disablePadding>
        {specials.slice(0, 3).map((item) => (
          <ListItemButton
            key={item.id}
            onClick={() => trackEvent('special_tapped', { special_id: item.id, type: item.type })}
            sx={{ borderRadius: 1, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              {ICON_MAP[item.icon] ?? <StarIcon color="primary" />}
            </ListItemIcon>
            <ListItemText
              primary={item.title}
              secondary={item.subtitle}
              primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }}
              secondaryTypographyProps={{ fontSize: '0.75rem' }}
            />
            <ChevronRightIcon color="action" />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
