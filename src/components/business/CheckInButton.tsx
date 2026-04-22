import { memo, useCallback } from 'react';
import { Button, CircularProgress } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useCheckIn } from '../../hooks/useCheckIn';
import { useToast } from '../../context/ToastContext';
import { useBusinessScope } from '../../context/BusinessScopeContext';
import { MSG_CHECKIN, MSG_AUTH } from '../../constants/messages';
import { logger } from '../../utils/logger';

export default memo(function CheckInButton() {
  const toast = useToast();
  const { businessId, businessName, location } = useBusinessScope();
  const { hasCheckedInRecently, isNearby, status, recentCheckInId, performCheckIn, undoCheckIn } = useCheckIn(
    businessId,
    businessName,
    location,
  );

  const isLoading = status === 'loading';
  const isSuccess = status === 'success' || hasCheckedInRecently;

  const handleClick = useCallback(async () => {
    try {
      if (isSuccess && recentCheckInId) {
        const result = await undoCheckIn();
        if (result === 'success') toast.info(MSG_CHECKIN.removed);
        if (result === 'blocked') toast.info(MSG_AUTH.loginRequired);
        return;
      }

      if (!isNearby) {
        toast.info(MSG_CHECKIN.tooFar);
      }

      const result = await performCheckIn();
      if (result === 'success') toast.success(MSG_CHECKIN.success);
      if (result === 'blocked') toast.info(MSG_AUTH.loginRequired);
    } catch (err) {
      logger.error('[CheckInButton] handleClick failed:', err);
      toast.error(MSG_CHECKIN.error);
    }
  }, [isNearby, isSuccess, recentCheckInId, performCheckIn, undoCheckIn, toast]);

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
      fullWidth
      sx={{ textTransform: 'none', borderRadius: '12px' }}
    >
      {isSuccess ? 'Check-in ✓' : 'Hacer check-in'}
    </Button>
  );
});
