import { Box, List, Typography, Button, CircularProgress, Divider } from '@mui/material';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import NotificationItem from '../notifications/NotificationItem';
import { useNotifications } from '../../hooks/useNotifications';
import { useNavigateToBusiness } from '../../hooks/useNavigateToBusiness';
import type { AppNotification } from '../../types';

export default function NotificationsSection() {
  const { notifications, loading: isLoading, markRead, markAllRead } = useNotifications();
  const { navigateToBusiness } = useNavigateToBusiness();
  const unread = notifications.filter((n) => !n.read);

  const handleClick = async (notification: AppNotification) => {
    if (!notification.read) {
      await markRead(notification.id);
    }
    if (notification.businessId) {
      navigateToBusiness(notification.businessId);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (notifications.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <NotificationsOffIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography color="text.secondary">No tenés notificaciones</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {unread.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 2, pt: 1 }}>
          <Button
            size="small"
            startIcon={<DoneAllIcon />}
            onClick={markAllRead}
          >
            Marcar todas como leidas
          </Button>
        </Box>
      )}
      <List disablePadding>
        {notifications.map((n) => (
          <Box key={n.id}>
            <NotificationItem notification={n} onClick={handleClick} />
            <Divider component="li" />
          </Box>
        ))}
      </List>
    </Box>
  );
}
