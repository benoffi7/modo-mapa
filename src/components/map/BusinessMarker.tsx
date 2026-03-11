import { memo, useCallback } from 'react';
import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { Box } from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import SportsBarIcon from '@mui/icons-material/SportsBar';
import FastfoodIcon from '@mui/icons-material/Fastfood';
import IcecreamIcon from '@mui/icons-material/Icecream';
import LocalPizzaIcon from '@mui/icons-material/LocalPizza';
import type { Business, BusinessCategory } from '../../types';

const CATEGORY_CONFIG: Record<BusinessCategory, { icon: typeof RestaurantIcon; color: string }> = {
  restaurant: { icon: RestaurantIcon, color: '#ea4335' },
  cafe: { icon: LocalCafeIcon, color: '#795548' },
  bakery: { icon: BakeryDiningIcon, color: '#ff9800' },
  bar: { icon: SportsBarIcon, color: '#9c27b0' },
  fastfood: { icon: FastfoodIcon, color: '#f44336' },
  icecream: { icon: IcecreamIcon, color: '#e91e63' },
  pizza: { icon: LocalPizzaIcon, color: '#ff5722' },
};

interface Props {
  business: Business;
  isSelected: boolean;
  onClick: (id: string) => void;
}

const BusinessMarker = memo(function BusinessMarker({ business, isSelected, onClick }: Props) {
  const config = CATEGORY_CONFIG[business.category] || CATEGORY_CONFIG.restaurant;
  const Icon = config.icon;

  const handleClick = useCallback(() => {
    onClick(business.id);
  }, [onClick, business.id]);

  return (
    <AdvancedMarker
      position={{ lat: business.lat, lng: business.lng }}
      onClick={handleClick}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: isSelected ? 44 : 36,
          height: isSelected ? 44 : 36,
          borderRadius: '50%',
          backgroundColor: config.color,
          border: isSelected ? '3px solid #fff' : '2px solid #fff',
          boxShadow: isSelected
            ? '0 2px 8px rgba(0,0,0,0.4)'
            : '0 1px 4px rgba(0,0,0,0.3)',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
        }}
      >
        <Icon sx={{ color: '#fff', fontSize: isSelected ? 24 : 20 }} />
      </Box>
    </AdvancedMarker>
  );
});

export default BusinessMarker;
