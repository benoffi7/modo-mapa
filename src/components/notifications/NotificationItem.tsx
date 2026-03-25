import { ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import ReplyIcon from '@mui/icons-material/Reply';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SendIcon from '@mui/icons-material/Send';
import { formatRelativeTime } from '../../utils/formatDate';
import type { AppNotification } from '../../types';

interface Props {
  notification: AppNotification;
  onClick: (notification: AppNotification) => void;
}

function getIcon(type: AppNotification['type']) {
  switch (type) {
    case 'like':
      return <FavoriteIcon color="error" fontSize="small" />;
    case 'photo_approved':
    case 'photo_rejected':
      return <CameraAltIcon color="primary" fontSize="small" />;
    case 'ranking':
      return <LeaderboardIcon color="warning" fontSize="small" />;
    case 'feedback_response':
      return <FeedbackOutlinedIcon sx={{ color: 'success.main' }} fontSize="small" />;
    case 'comment_reply':
      return <ReplyIcon color="info" fontSize="small" />;
    case 'new_follower':
      return <PersonAddIcon color="info" fontSize="small" />;
    case 'recommendation':
      return <SendIcon color="secondary" fontSize="small" />;
  }
}

export default function NotificationItem({ notification, onClick }: Props) {
  return (
    <ListItemButton
      onClick={() => onClick(notification)}
      sx={{
        bgcolor: notification.read ? 'transparent' : 'action.hover',
        py: 1.5,
      }}
    >
      <ListItemIcon sx={{ minWidth: 40 }}>
        {getIcon(notification.type)}
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography
            variant="body2"
            sx={{ fontWeight: notification.read ? 'normal' : 'bold' }}
          >
            {notification.message}
          </Typography>
        }
        secondary={formatRelativeTime(notification.createdAt)}
      />
    </ListItemButton>
  );
}
