import { Drawer, Box, Typography, Button, List, Divider, CircularProgress, IconButton } from '@mui/material';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NotificationItem from './NotificationItem';
import { useSelection } from '../../context/SelectionContext';
import { allBusinesses } from '../../hooks/useBusinesses';
import type { AppNotification } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  loading: boolean;
  onMarkRead: (notificationId: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
}

export default function NotificationList({
  open,
  onClose,
  notifications,
  loading,
  onMarkRead,
  onMarkAllRead,
}: Props) {
  const { setSelectedBusiness } = useSelection();

  const handleClick = async (notification: AppNotification) => {
    if (!notification.read) {
      await onMarkRead(notification.id);
    }

    if (notification.businessId) {
      const biz = allBusinesses.find((b) => b.id === notification.businessId);
      if (biz) {
        setSelectedBusiness(biz);
      }
    }

    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 360 } } }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton edge="start" onClick={onClose} sx={{ display: { sm: 'none' } }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6">Notificaciones</Typography>
        </Box>
        {notifications.some((n) => !n.read) && (
          <Button
            size="small"
            startIcon={<DoneAllIcon sx={{ fontSize: 16 }} />}
            onClick={onMarkAllRead}
            sx={{ fontSize: '0.7rem', textTransform: 'none' }}
          >
            Marcar como leído
          </Button>
        )}
      </Box>
      <Divider />
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : notifications.length === 0 ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">No tenés notificaciones</Typography>
        </Box>
      ) : (
        <List disablePadding>
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onClick={handleClick} />
          ))}
        </List>
      )}
    </Drawer>
  );
}
