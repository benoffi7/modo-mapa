import { memo, useCallback } from 'react';
import { Button, CircularProgress } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAuth } from '../../context/AuthContext';
import { useCheckIn } from '../../hooks/useCheckIn';
import { useToast } from '../../context/ToastContext';

interface Props {
  businessId: string;
  businessName: string;
  businessLocation?: { lat: number; lng: number };
}

export default memo(function CheckInButton({ businessId, businessName, businessLocation }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { hasCheckedInRecently, isNearby, status, recentCheckInId, performCheckIn, undoCheckIn } = useCheckIn(
    businessId,
    businessName,
    businessLocation,
  );

  const isLoading = status === 'loading';
  const isSuccess = status === 'success' || hasCheckedInRecently;

  const handleClick = useCallback(async () => {
    if (!user || user.isAnonymous) {
      toast.info('Iniciá sesión para registrar visitas');
      return;
    }

    if (isSuccess && recentCheckInId) {
      await undoCheckIn();
      toast.info('Visita desmarcada');
      return;
    }

    if (!isNearby) {
      toast.info('Parece que no estás cerca de este comercio');
    }

    await performCheckIn();

    if (status !== 'error') {
      toast.success('Visita registrada');
    }
  }, [user, isNearby, isSuccess, recentCheckInId, performCheckIn, undoCheckIn, status, toast]);

  return (
    <Button
      variant={isSuccess ? 'outlined' : 'contained'}
      size="small"
      startIcon={
        isLoading ? <CircularProgress size={16} color="inherit" /> :
        isSuccess ? <CheckCircleIcon /> :
        <PlaceIcon />
      }
      onClick={handleClick}
      disabled={isLoading}
      color={isSuccess ? 'success' : 'primary'}
      sx={{ textTransform: 'none', borderRadius: '12px' }}
    >
      {isSuccess ? 'Check-in ✓' : 'Hacer check-in'}
    </Button>
  );
});
