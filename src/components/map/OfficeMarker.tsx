import { AdvancedMarker } from '@vis.gl/react-google-maps';
import ApartmentIcon from '@mui/icons-material/Apartment';
import { OFFICE_LOCATION } from '../../constants/map';

export default function OfficeMarker() {
  return (
    <AdvancedMarker position={OFFICE_LOCATION}>
      <div
        aria-label="Oficina"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: '50%',
          backgroundColor: '#1565c0',
          border: '3px solid #fff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        }}
      >
        <ApartmentIcon sx={{ color: '#fff', fontSize: 20 }} />
      </div>
    </AdvancedMarker>
  );
}
