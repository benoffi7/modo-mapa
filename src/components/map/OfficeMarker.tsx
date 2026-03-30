import { AdvancedMarker } from '@vis.gl/react-google-maps';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import ApartmentIcon from '@mui/icons-material/Apartment';
import { OFFICE_LOCATION } from '../../constants/map';

export default function OfficeMarker() {
  return (
    <AdvancedMarker position={OFFICE_LOCATION}>
      <Box
        aria-label="Oficina"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: '50%',
          bgcolor: 'primary.dark',
          border: (theme) => `3px solid ${theme.palette.background.paper}`,
          boxShadow: (theme) => `0 2px 6px ${alpha(theme.palette.common.black, 0.3)}`,
        }}
      >
        <ApartmentIcon sx={{ color: 'common.white', fontSize: 20 }} />
      </Box>
    </AdvancedMarker>
  );
}
