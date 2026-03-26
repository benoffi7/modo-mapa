import { List, ListItemButton, ListItemIcon, ListItemText, Badge, Button, Box } from '@mui/material';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../context/AuthContext';

export type SettingsSection = 'notifications' | 'pendientes' | 'privacy' | 'config' | 'help';

interface Props {
  onNavigate: (section: SettingsSection) => void;
  hasPendingActions: boolean;
}

export default function SettingsMenu({ onNavigate, hasPendingActions }: Props) {
  const { notifications } = useNotifications();
  const { authMethod, signOut } = useAuth();
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <List disablePadding>
        <ListItemButton onClick={() => onNavigate('notifications')}>
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Badge badgeContent={unreadCount} color="primary" max={99}>
              <NotificationsOutlinedIcon />
            </Badge>
          </ListItemIcon>
          <ListItemText primary="Notificaciones" />
          <ChevronRightIcon color="action" />
        </ListItemButton>

        {hasPendingActions && (
          <ListItemButton onClick={() => onNavigate('pendientes')}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <SyncProblemIcon color="warning" />
            </ListItemIcon>
            <ListItemText primary="Pendientes" />
            <ChevronRightIcon color="action" />
          </ListItemButton>
        )}

        <ListItemButton onClick={() => onNavigate('privacy')}>
          <ListItemIcon sx={{ minWidth: 40 }}>
            <ShieldOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="Privacidad" />
          <ChevronRightIcon color="action" />
        </ListItemButton>

        <ListItemButton onClick={() => onNavigate('config')}>
          <ListItemIcon sx={{ minWidth: 40 }}>
            <SettingsOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="Configuración" />
          <ChevronRightIcon color="action" />
        </ListItemButton>

        <ListItemButton onClick={() => onNavigate('help')}>
          <ListItemIcon sx={{ minWidth: 40 }}>
            <HelpOutlineIcon />
          </ListItemIcon>
          <ListItemText primary="Ayuda y soporte" />
          <ChevronRightIcon color="action" />
        </ListItemButton>
      </List>

      {authMethod !== 'anonymous' && (
        <Box sx={{ px: 2, pt: 2, pb: 1 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<LogoutIcon />}
            onClick={signOut}
          >
            Cerrar sesión
          </Button>
        </Box>
      )}
    </>
  );
}
