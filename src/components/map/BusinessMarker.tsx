import { memo, useCallback } from 'react';
import { AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { CATEGORY_COLORS } from '../../constants/map';
import type { Business } from '../../types';

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
