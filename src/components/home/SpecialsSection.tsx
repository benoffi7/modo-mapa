import { Box, Typography, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StarIcon from '@mui/icons-material/Star';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { trackEvent } from '../../utils/analytics';

/**
 * Specials section — placeholder with hardcoded items.
 * Will be replaced with Firestore-backed data in Phase 6b.
 */
const PLACEHOLDER_SPECIALS = [
  { id: '1', title: 'Trending esta semana', subtitle: 'Los comercios mas populares', icon: <LocalFireDepartmentIcon color="error" /> },
  { id: '2', title: 'Mejor calificados', subtitle: 'Top 10 por rating', icon: <StarIcon color="warning" /> },
  { id: '3', title: 'En crecimiento', subtitle: 'Nuevos favoritos de la comunidad', icon: <TrendingUpIcon color="success" /> },
];

export default function SpecialsSection() {
  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
        Especiales
      </Typography>
      <List disablePadding>
        {PLACEHOLDER_SPECIALS.map((item) => (
          <ListItemButton
            key={item.id}
            onClick={() => trackEvent('special_tapped', { special_id: item.id })}
            sx={{ borderRadius: 1, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              {item.icon}
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
