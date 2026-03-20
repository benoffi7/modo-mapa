import { Fab, CircularProgress } from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { useUserLocation } from '../../hooks/useUserLocation';

export default function LocationFAB() {
  const { requestLocation, isLocating } = useUserLocation();

  return (
    <Fab
      size="medium"
      aria-label="Mi ubicación"
      onClick={requestLocation}
      disabled={isLocating}
      sx={{
        position: 'absolute',
        bottom: 24,
        right: 16,
        backgroundColor: 'background.paper',
        color: 'text.secondary',
        '&:hover': {
          backgroundColor: 'background.default',
        },
        zIndex: 1000,
      }}
    >
      {isLocating ? (
        <CircularProgress size={24} color="primary" />
      ) : (
        <MyLocationIcon />
      )}
    </Fab>
  );
}
