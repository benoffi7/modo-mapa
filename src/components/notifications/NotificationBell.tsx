import { useState, useCallback } from 'react';
import { IconButton, Badge } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationList from './NotificationList';
import { useNotifications } from '../../hooks/useNotifications';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, markRead, markAllRead, refresh } = useNotifications();

  const handleOpen = useCallback(() => {
    refresh();
    setOpen(true);
  }, [refresh]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
      <IconButton
        size="small"
        aria-label="Notificaciones"
        onClick={handleOpen}
        sx={{ p: 1, color: 'text.secondary' }}
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <NotificationList
        open={open}
        onClose={handleClose}
        notifications={notifications}
        loading={loading}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
      />
    </>
  );
}
