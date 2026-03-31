import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Dialog, DialogTitle, DialogContent, List, ListItemButton, ListItemText, IconButton } from '@mui/material';
import { cardSx, iconCircleSx } from '../../theme/cards';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StarIcon from '@mui/icons-material/Star';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ExploreIcon from '@mui/icons-material/Explore';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import FavoriteIcon from '@mui/icons-material/Favorite';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import { trackEvent } from '../../utils/analytics';
import { logger } from '../../utils/logger';
import { useNavigateToBusiness } from '../../hooks/useNavigateToBusiness';
import { allBusinesses } from '../../hooks/useBusinesses';
import { CATEGORY_LABELS } from '../../constants/business';
import type { Special, Business, BusinessCategory } from '../../types';
import { fetchActiveSpecials } from '../../services/specials';

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

/** Deterministic pseudo-random shuffle seeded by special id */
function getBusinessesForSpecial(specialId: string): Business[] {
  const seed = specialId.charCodeAt(0) + (specialId.charCodeAt(1) || 0);
  const shuffled = [...allBusinesses].sort((a, b) => {
    const ha = (a.id.charCodeAt(0) * 31 + seed) % 100;
    const hb = (b.id.charCodeAt(0) * 31 + seed) % 100;
    return ha - hb;
  });
  return shuffled.slice(0, 10);
}

export default function SpecialsSection() {
  const [specials, setSpecials] = useState<Special[]>(FALLBACK_SPECIALS);
  const [selectedSpecial, setSelectedSpecial] = useState<Special | null>(null);
  const { navigateToBusiness } = useNavigateToBusiness();

  const handleClick = (item: Special) => {
    trackEvent('special_tapped', { special_id: item.id, type: item.type });
    setSelectedSpecial(item);
  };

  const businessList = useMemo(() => {
    if (!selectedSpecial) return [];
    return getBusinessesForSpecial(selectedSpecial.id);
  }, [selectedSpecial]);

  useEffect(() => {
    let cancelled = false;
    fetchActiveSpecials()
      .then((data) => {
        if (!cancelled && data.length > 0) {
          setSpecials(data);
        }
      })
      .catch((err) => { logger.warn('[SpecialsSection] Failed to load from Firestore, using fallback:', err); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
        Especiales
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {specials.slice(0, 3).map((item) => (
          <Box
            key={item.id}
            onClick={() => handleClick(item)}
            sx={{ ...cardSx, display: 'flex', alignItems: 'center', gap: 1.5 }}
          >
            <Box sx={iconCircleSx('action.selected')}>
              {ICON_MAP[item.icon] ?? <StarIcon color="primary" />}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={600}>{item.title}</Typography>
              <Typography variant="caption" color="text.secondary">{item.subtitle}</Typography>
            </Box>
            <ChevronRightIcon color="action" />
          </Box>
        ))}
      </Box>

      <Dialog
        open={!!selectedSpecial}
        onClose={() => setSelectedSpecial(null)}
        maxWidth="xs"
        fullWidth
      >
        {selectedSpecial && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
              {ICON_MAP[selectedSpecial.icon] ?? <StarIcon color="primary" />}
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>{selectedSpecial.title}</Typography>
                <Typography variant="caption" color="text.secondary">{selectedSpecial.subtitle}</Typography>
              </Box>
              <IconButton
                onClick={() => setSelectedSpecial(null)}
                sx={{ position: 'absolute', right: 8, top: 8 }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ px: 1, pb: 2 }}>
              <List disablePadding>
                {businessList.map((biz, idx) => (
                  <ListItemButton
                    key={biz.id}
                    onClick={() => {
                      setSelectedSpecial(null);
                      navigateToBusiness(biz);
                    }}
                    dense
                  >
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 24 }}>
                      {idx + 1}
                    </Typography>
                    <ListItemText
                      primary={biz.name}
                      secondary={CATEGORY_LABELS[biz.category as BusinessCategory] ?? biz.category}
                      primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }}
                      secondaryTypographyProps={{ fontSize: '0.75rem' }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}
