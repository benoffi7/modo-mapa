import { Box, Card, CardActionArea, Typography, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import SportsBarIcon from '@mui/icons-material/SportsBar';
import FastfoodIcon from '@mui/icons-material/Fastfood';
import IcecreamIcon from '@mui/icons-material/Icecream';
import LocalPizzaIcon from '@mui/icons-material/LocalPizza';
import { useSuggestions } from '../../hooks/useSuggestions';
import { useNavigateToBusiness } from '../../hooks/useNavigateToBusiness';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../constants/business';
import { getContrastText } from '../../utils/contrast';
import { trackEvent } from '../../utils/analytics';
import type { BusinessCategory } from '../../types';

function getCategoryIcon(category: BusinessCategory | string, bgHex: string): React.ReactElement {
  const color = getContrastText(bgHex);
  const sx = { fontSize: 32, color };
  switch (category) {
    case 'restaurant': return <RestaurantIcon sx={sx} />;
    case 'cafe': return <LocalCafeIcon sx={sx} />;
    case 'bakery': return <BakeryDiningIcon sx={sx} />;
    case 'bar': return <SportsBarIcon sx={sx} />;
    case 'fastfood': return <FastfoodIcon sx={sx} />;
    case 'icecream': return <IcecreamIcon sx={sx} />;
    case 'pizza': return <LocalPizzaIcon sx={sx} />;
    default: return <RestaurantIcon sx={sx} />;
  }
}

export default function ForYouSection() {
  const theme = useTheme();
  const { suggestions, isLoading } = useSuggestions();
  const { navigateToBusiness } = useNavigateToBusiness();
  const fallbackBg = theme.palette.grey[600];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Para vos
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, overflow: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
        {suggestions.slice(0, 8).map((s) => {
          const cat = s.business.category as BusinessCategory;
          const bgColor = CATEGORY_COLORS[cat] ?? fallbackBg;
          const icon = getCategoryIcon(cat, bgColor);
          return (
            <Card
              key={s.business.id}
              variant="outlined"
              sx={{ minWidth: 170, maxWidth: 190, flexShrink: 0 }}
            >
              <CardActionArea
                onClick={() => {
                  trackEvent('for_you_tapped', { business_id: s.business.id });
                  navigateToBusiness(s.business);
                }}
              >
                {/* Category image placeholder */}
                <Box
                  sx={{
                    height: 90,
                    bgcolor: bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {icon}
                </Box>
                <Box sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={600} noWrap>
                    {s.business.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {CATEGORY_LABELS[cat] ?? cat}
                  </Typography>
                  <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 0.25 }}>
                    {s.reasons.length > 0 ? (s.reasons.includes('nearby') ? 'Cerca tuyo' : 'Sugerido') : 'Sugerido'}
                  </Typography>
                </Box>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
