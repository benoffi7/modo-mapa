import { Box, Card, CardActionArea, Typography, CircularProgress } from '@mui/material';
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
import { trackEvent } from '../../utils/analytics';
import type { BusinessCategory } from '../../types';

const CATEGORY_ICONS: Record<string, React.ReactElement> = {
  restaurant: <RestaurantIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.8)' }} />,
  cafe: <LocalCafeIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.8)' }} />,
  bakery: <BakeryDiningIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.8)' }} />,
  bar: <SportsBarIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.8)' }} />,
  fastfood: <FastfoodIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.8)' }} />,
  icecream: <IcecreamIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.8)' }} />,
  pizza: <LocalPizzaIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.8)' }} />,
};

export default function ForYouSection() {
  const { suggestions, isLoading } = useSuggestions();
  const { navigateToBusiness } = useNavigateToBusiness();

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
          const bgColor = CATEGORY_COLORS[cat] ?? '#546e7a';
          const icon = CATEGORY_ICONS[cat] ?? CATEGORY_ICONS.restaurant;
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
