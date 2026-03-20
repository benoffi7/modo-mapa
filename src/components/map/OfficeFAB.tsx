import { Fab } from '@mui/material';
import ApartmentIcon from '@mui/icons-material/Apartment';
import { useMap } from '@vis.gl/react-google-maps';
import { useCallback } from 'react';
import { OFFICE_LOCATION } from '../../constants/map';

export default function OfficeFAB() {
  const map = useMap();

  const handleClick = useCallback(() => {
    if (!map) return;
    map.panTo(OFFICE_LOCATION);
    map.setZoom(15);
  }, [map]);

  return (
    <Fab
      size="medium"
      aria-label="Ir a oficina"
      onClick={handleClick}
      sx={{
        position: 'absolute',
        bottom: 24,
        right: 72,
        backgroundColor: 'background.paper',
        color: 'text.secondary',
        '&:hover': {
          backgroundColor: 'background.default',
        },
        zIndex: 1000,
      }}
    >
      <ApartmentIcon />
    </Fab>
  );
}
