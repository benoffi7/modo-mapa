import { List, ListItemButton, ListItemIcon, ListItemText, Badge } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useNotifications } from '../../hooks/useNotifications';

export type SettingsSection = 'notifications' | 'pendientes' | 'privacy' | 'config' | 'help';

interface Props {
  onNavigate: (section: SettingsSection) => void;
  hasPendingActions: boolean;
}

export default function SettingsMenu({ onNavigate, hasPendingActions }: Props) {
  const { notifications } = useNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <List disablePadding>
      <ListItemButton onClick={() => onNavigate('notifications')}>
        <ListItemIcon sx={{ minWidth: 40 }}>
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsIcon />
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
          <SecurityIcon />
        </ListItemIcon>
        <ListItemText primary="Privacidad" />
        <ChevronRightIcon color="action" />
      </ListItemButton>

      <ListItemButton onClick={() => onNavigate('config')}>
        <ListItemIcon sx={{ minWidth: 40 }}>
          <SettingsIcon />
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
  );
}
