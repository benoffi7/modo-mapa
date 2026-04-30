import { useState } from 'react';
import { Badge, Button, Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Alert } from '@mui/material';
import { cardSx } from '../../theme/cards';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LogoutIcon from '@mui/icons-material/Logout';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../context/AuthContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { cleanAnonymousData } from '../../services/emailAuth';
import { MSG_OFFLINE } from '../../constants/messages';

export type SettingsSection = 'notifications' | 'pendientes' | 'privacy' | 'config' | 'help';

interface MenuItemProps {
  icon: React.ReactElement;
  label: string;
  badge?: number;
  onClick: () => void;
}

function MenuItem({ icon, label, badge, onClick }: MenuItemProps) {
  return (
    <Box
      onClick={onClick}
      sx={{ ...cardSx, display: 'flex', alignItems: 'center', gap: 1.5 }}
    >
      {badge ? (
        <Badge badgeContent={badge} color="primary" max={99}>{icon}</Badge>
      ) : icon}
      <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>{label}</Typography>
      <ChevronRightIcon color="action" sx={{ fontSize: 20 }} />
    </Box>
  );
}

interface Props {
  onNavigate: (section: SettingsSection) => void;
  hasPendingActions: boolean;
}

export default function SettingsMenu({ onNavigate, hasPendingActions }: Props) {
  const { notifications } = useNotifications();
  const { signOut, authMethod } = useAuth();
  const { isOffline } = useConnectivity();
  const unreadCount = notifications.filter((n) => !n.read).length;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAnonymous = authMethod === 'anonymous';

  const handleConfirm = async () => {
    if (isAnonymous) {
      // #323 S2 (HIGH): defensa adicional al gate del boton trigger.
      if (isOffline) {
        setError(MSG_OFFLINE.cleanAnonOffline);
        return;
      }
      // Clean server-side data before signing out
      setLoading(true);
      setError(null);
      try {
        await cleanAnonymousData();
        await signOut();
        setConfirmOpen(false);
      } catch {
        setError('No se pudieron limpiar los datos. Intentá de nuevo.');
      } finally {
        setLoading(false);
      }
    } else {
      try {
        await signOut();
      } catch {
        // signOut error handled silently
      }
      setConfirmOpen(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setConfirmOpen(false);
    setError(null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 2, pb: 2 }}>
      <MenuItem
        icon={<NotificationsOutlinedIcon />}
        label="Notificaciones"
        badge={unreadCount}
        onClick={() => onNavigate('notifications')}
      />

      {hasPendingActions && (
        <MenuItem
          icon={<SyncProblemIcon color="warning" />}
          label="Pendientes"
          onClick={() => onNavigate('pendientes')}
        />
      )}

      <MenuItem
        icon={<ShieldOutlinedIcon />}
        label="Privacidad"
        onClick={() => onNavigate('privacy')}
      />

      <MenuItem
        icon={<SettingsOutlinedIcon />}
        label="Configuración"
        onClick={() => onNavigate('config')}
      />

      <MenuItem
        icon={<HelpOutlineIcon />}
        label="Ayuda y soporte"
        onClick={() => onNavigate('help')}
      />

      {isAnonymous ? (
        <Button
          fullWidth
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => setConfirmOpen(true)}
          disabled={isOffline}
          sx={{ mt: 1 }}
        >
          Empezar de cero
        </Button>
      ) : (
        <Button
          fullWidth
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          onClick={() => setConfirmOpen(true)}
          sx={{ mt: 1 }}
        >
          Cerrar sesión
        </Button>
      )}

      <Dialog open={confirmOpen} onClose={handleClose} maxWidth="xs" role="alertdialog" aria-describedby="logout-warning">
        <DialogTitle>{isAnonymous ? '¿Empezar de cero?' : '¿Cerrar sesión?'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>
          )}
          <Typography id="logout-warning" variant="body2">
            {isAnonymous
              ? 'Se van a borrar todos tus datos del servidor (favoritos, calificaciones, listas, etc.) y vas a empezar de cero con una cuenta nueva. Esta acción no se puede deshacer.'
              : 'Vas a necesitar tu email y contraseña para volver a entrar.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            color="error"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
          >
            {isAnonymous ? 'Empezar de cero' : 'Cerrar sesión'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
