import { memo } from 'react';
import { ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { formatRelativeTime } from '../../utils/formatDate';
import type { ActivityFeedItem as FeedItem } from '../../types';

const TYPE_ICONS = {
  rating: StarIcon,
  comment: ChatBubbleIcon,
  favorite: FavoriteIcon,
} as const;

const TYPE_LABELS = {
  rating: 'califico',
  comment: 'comento en',
  favorite: 'agrego a favoritos',
} as const;

interface ActivityFeedItemProps {
  item: FeedItem;
  onClick: (businessId: string) => void;
}

export const ActivityFeedItemRow = memo(function ActivityFeedItemRow({
  item,
  onClick,
}: ActivityFeedItemProps) {
  const Icon = TYPE_ICONS[item.type];

  return (
    <ListItemButton onClick={() => onClick(item.businessId)} sx={{ py: 1 }}>
      <ListItemIcon sx={{ minWidth: 36 }}>
        <Icon fontSize="small" color="action" />
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography variant="body2">
            <strong>{item.actorName}</strong> {TYPE_LABELS[item.type]}{' '}
            <strong>{item.businessName}</strong>
          </Typography>
        }
        secondary={formatRelativeTime(item.createdAt)}
      />
    </ListItemButton>
  );
});
