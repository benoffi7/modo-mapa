import { useState } from 'react';
import { Badge, Button, Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
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
  const unreadCount = notifications.filter((n) => !n.read).length;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isAnonymous = authMethod === 'anonymous';

  const handleConfirm = async () => {
    try {
      await signOut();
    } catch {
      // signOut error handled silently — new anonymous session still created
    }
    setConfirmOpen(false);
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

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs">
        <DialogTitle>{isAnonymous ? '¿Empezar de cero?' : '¿Cerrar sesión?'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {isAnonymous
              ? 'Vas a empezar de cero con una cuenta nueva. Tus datos anteriores ya no van a estar vinculados a tu cuenta.'
              : 'Vas a necesitar tu email y contraseña para volver a entrar.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} color="error" variant="contained">
            {isAnonymous ? 'Empezar de cero' : 'Cerrar sesión'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
