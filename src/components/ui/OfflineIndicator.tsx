import { Chip } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import { useConnectivity } from '../../hooks/useConnectivity';
import { MSG_OFFLINE } from '../../constants/messages';

export function OfflineIndicator() {
  const { isOffline, isSyncing, pendingActionsCount } = useConnectivity();

  if (!isOffline && !isSyncing) return null;

  const label = isSyncing
    ? 'Sincronizando...'
    : pendingActionsCount > 0
      ? MSG_OFFLINE.noConnectionPending(pendingActionsCount)
      : MSG_OFFLINE.noConnection;

  return (
    <Chip
      icon={isSyncing ? <SyncIcon sx={{ animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} /> : <CloudOffIcon />}
      label={label}
      color={isSyncing ? 'info' : 'warning'}
      size="small"
      role="status"
      aria-live="polite"
      sx={{
        position: 'fixed',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1200,
        maxWidth: 'calc(100vw - 32px)',
      }}
    />
  );
}
