import { Button } from '@mui/material';
import DirectionsIcon from '@mui/icons-material/Directions';
import type { Business } from '../../types';
import { useMapContext } from '../../context/MapContext';

interface Props {
  business: Business;
}

export default function DirectionsButton({ business }: Props) {
  const { userLocation } = useMapContext();

  const handleClick = () => {
    let url: string;
    if (userLocation) {
      url = `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${business.lat},${business.lng}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${business.lat},${business.lng}`;
    }
    window.open(url, '_blank');
  };

  return (
    <Button
      variant="contained"
      startIcon={<DirectionsIcon />}
      onClick={handleClick}
      sx={{
        borderRadius: '20px',
        textTransform: 'none',
        fontWeight: 500,
        px: 3,
      }}
    >
      Cómo llegar
    </Button>
  );
}
