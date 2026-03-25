import { Chip } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import { useConnectivity } from '../../hooks/useConnectivity';

export function OfflineIndicator() {
  const { isOffline, isSyncing, pendingActionsCount } = useConnectivity();

  if (!isOffline && !isSyncing) return null;

  const label = isSyncing
    ? 'Sincronizando...'
    : pendingActionsCount > 0
      ? `Sin conexion - ${pendingActionsCount} pendiente${pendingActionsCount > 1 ? 's' : ''}`
      : 'Sin conexion';

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
