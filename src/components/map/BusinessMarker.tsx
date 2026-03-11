import { memo, useCallback } from 'react';
import { AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import type { Business, BusinessCategory } from '../../types';

const CATEGORY_COLORS: Record<BusinessCategory, string> = {
  restaurant: '#ea4335',
  cafe: '#795548',
  bakery: '#ff9800',
  bar: '#9c27b0',
  fastfood: '#f44336',
  icecream: '#e91e63',
  pizza: '#ff5722',
};

interface Props {
  business: Business;
  isSelected: boolean;
  onClick: (id: string) => void;
}

const BusinessMarker = memo(function BusinessMarker({ business, isSelected, onClick }: Props) {
  const color = CATEGORY_COLORS[business.category] || CATEGORY_COLORS.restaurant;

  const handleClick = useCallback(() => {
    onClick(business.id);
  }, [onClick, business.id]);

  return (
    <AdvancedMarker
      position={{ lat: business.lat, lng: business.lng }}
      onClick={handleClick}
    >
      <Pin
        background={color}
        borderColor={isSelected ? '#fff' : color}
        glyphColor="#fff"
        scale={isSelected ? 1.3 : 1}
      />
    </AdvancedMarker>
  );
});

export default BusinessMarker;
