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
  const { hasCheckedInRecently, isNearby, canCheckIn, status, performCheckIn } = useCheckIn(
    businessId,
    businessName,
    businessLocation,
  );

  const handleClick = useCallback(async () => {
    if (!user || user.isAnonymous) {
      toast.info('Iniciá sesión para registrar visitas');
      return;
    }

    if (!isNearby) {
      toast.info('Parece que no estás cerca de este comercio');
    }

    await performCheckIn();

    if (status !== 'error') {
      toast.success('Visita registrada');
    }
  }, [user, isNearby, performCheckIn, status, toast]);

  const isLoading = status === 'loading';
  const isSuccess = status === 'success' || hasCheckedInRecently;

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
      disabled={isLoading || !canCheckIn}
      color={isSuccess ? 'success' : 'primary'}
      sx={{ textTransform: 'none', borderRadius: 2 }}
    >
      {isSuccess ? 'Ya registraste visita' : 'Fui acá'}
    </Button>
  );
});
