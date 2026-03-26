import { Box, Typography, IconButton } from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import SportsBarIcon from '@mui/icons-material/SportsBar';
import FastfoodIcon from '@mui/icons-material/Fastfood';
import IcecreamIcon from '@mui/icons-material/Icecream';
import LocalPizzaIcon from '@mui/icons-material/LocalPizza';
import CasinoIcon from '@mui/icons-material/Casino';
import { useTabNavigation } from '../../hooks/useTabNavigation';
import { useTab } from '../../context/TabContext';
import { useSurpriseMe } from '../../hooks/useSurpriseMe';
import { useSelection } from '../../context/SelectionContext';
import { trackEvent } from '../../utils/analytics';
import type { BusinessCategory } from '../../types';

interface QuickActionSlot {
  id: string;
  label: string;
  icon: React.ReactElement;
  type: 'category' | 'action';
}

const CATEGORY_ICONS: Record<BusinessCategory, React.ReactElement> = {
  restaurant: <RestaurantIcon />,
  cafe: <LocalCafeIcon />,
  bakery: <BakeryDiningIcon />,
  bar: <SportsBarIcon />,
  fastfood: <FastfoodIcon />,
  icecream: <IcecreamIcon />,
  pizza: <LocalPizzaIcon />,
};

const DEFAULT_SLOTS: QuickActionSlot[] = [
  { id: 'restaurant', label: 'Restaurante', icon: CATEGORY_ICONS.restaurant, type: 'category' },
  { id: 'cafe', label: 'Cafe', icon: CATEGORY_ICONS.cafe, type: 'category' },
  { id: 'bar', label: 'Bar', icon: CATEGORY_ICONS.bar, type: 'category' },
  { id: 'pizza', label: 'Pizzeria', icon: CATEGORY_ICONS.pizza, type: 'category' },
  { id: 'fastfood', label: 'Rapida', icon: CATEGORY_ICONS.fastfood, type: 'category' },
  { id: 'bakery', label: 'Panaderia', icon: CATEGORY_ICONS.bakery, type: 'category' },
  { id: 'icecream', label: 'Heladeria', icon: CATEGORY_ICONS.icecream, type: 'category' },
  { id: 'sorprendeme', label: 'Sorpresa', icon: <CasinoIcon />, type: 'action' },
];

export default function QuickActions() {
  const { navigateToSearchWithFilter } = useTabNavigation();
  const { setSelectedBusiness } = useSelection();
  const { setActiveTab } = useTab();
  const { handleSurprise } = useSurpriseMe({
    onSelect: (biz) => { setSelectedBusiness(biz); setActiveTab('buscar'); },
    onClose: () => {},
  });

  const handleTap = (slot: QuickActionSlot) => {
    trackEvent('quick_action_tapped', { action_id: slot.id, type: slot.type });
    if (slot.type === 'category') {
      navigateToSearchWithFilter({ type: 'category', value: slot.id });
    } else if (slot.id === 'sorprendeme') {
      handleSurprise();
    }
  };

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Acciones rapidas
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
        {DEFAULT_SLOTS.map((slot) => (
          <Box key={slot.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              onClick={() => handleTap(slot)}
              sx={{
                bgcolor: 'action.hover',
                width: 48,
                height: 48,
              }}
            >
              {slot.icon}
            </IconButton>
            <Typography variant="caption" noWrap sx={{ maxWidth: 64, textAlign: 'center' }}>
              {slot.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
