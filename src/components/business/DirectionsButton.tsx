import { Button } from '@mui/material';
import DirectionsIcon from '@mui/icons-material/Directions';
import { trackEvent } from '../../utils/analytics';
import type { Business } from '../../types';
import { useFilters } from '../../context/FiltersContext';

interface Props {
  business: Business;
}

export default function DirectionsButton({ business }: Props) {
  const { userLocation } = useFilters();

  const handleClick = () => {
    let url: string;
    if (userLocation) {
      url = `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${business.lat},${business.lng}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${business.lat},${business.lng}`;
    }
    window.open(url, '_blank');
    trackEvent('business_directions', { business_id: business.id });
  };

  return (
    <Button
      variant="contained"
      aria-label="Cómo llegar"
      startIcon={<DirectionsIcon />}
      onClick={handleClick}
      sx={{
        borderRadius: '12px',
        textTransform: 'none',
        fontWeight: 500,
        px: 3,
      }}
    >
      Cómo llegar
    </Button>
  );
}
