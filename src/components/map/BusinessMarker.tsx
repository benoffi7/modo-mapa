import { memo, useCallback, useMemo } from 'react';
import { AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { useTheme } from '@mui/material/styles';
import { CATEGORY_COLORS } from '../../constants/business';
import type { Business } from '../../types';

interface Props {
  business: Business;
  isSelected: boolean;
  onClick: (id: string) => void;
  averageRating: number | null;
}

const BusinessMarker = memo(function BusinessMarker({ business, isSelected, onClick, averageRating }: Props) {
  const theme = useTheme();
  const color = CATEGORY_COLORS[business.category] || CATEGORY_COLORS.restaurant;
  // background.paper resuelve a '#ffffff' en light y '#1e1e1e' en dark.
  // Son strings hex validos para la API Pin de @vis.gl/react-google-maps.
  const contrastColor = theme.palette.background.paper;

  const handleClick = useCallback(() => {
    onClick(business.id);
  }, [onClick, business.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(business.id);
    }
  }, [onClick, business.id]);

  const ariaLabel = useMemo(() => {
    if (averageRating != null) {
      return `${business.name}, ${averageRating.toFixed(1)} estrellas`;
    }
    return `${business.name}, sin calificaciones`;
  }, [business.name, averageRating]);

  return (
    <AdvancedMarker
      position={{ lat: business.lat, lng: business.lng }}
      onClick={handleClick}
    >
      <div
        tabIndex={0}
        role="button"
        aria-label={ariaLabel}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{ outline: 'none', cursor: 'pointer', position: 'relative' }}
        className={`marker-focus ${isSelected ? 'marker-selected' : ''}`}
      >
        <div style={{ pointerEvents: 'none' }}>
          <Pin
            background={color}
            borderColor={isSelected ? contrastColor : color}
            glyphColor={contrastColor}
            scale={isSelected ? 1.3 : 1}
          />
        </div>
      </div>
    </AdvancedMarker>
  );
});

export default BusinessMarker;
