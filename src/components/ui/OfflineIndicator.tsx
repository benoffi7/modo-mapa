import { Chip } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import { useConnectivity } from '../../context/ConnectivityContext';
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
        // #323 Cycle 3: por encima de Snackbar (theme.zIndex.snackbar = 1400).
        // Snackbar es el caso real de tapado durante el flush (visible 5s+ con toasts
        // de "Sincronizando..." / "Acción aplicada"). Modal (1300) y Backdrop quedan
        // automáticamente por debajo. Tooltip (1500) puede taparlo, pero es hover-only
        // y efímero — aceptable trade-off.
        zIndex: (theme) => theme.zIndex.snackbar + 1,
        maxWidth: 'calc(100vw - 32px)',
      }}
    />
  );
}
