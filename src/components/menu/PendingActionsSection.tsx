import { useState, memo } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Typography,
  Button,
} from '@mui/material';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ReplayIcon from '@mui/icons-material/Replay';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useConnectivity } from '../../hooks/useConnectivity';
import { MSG_OFFLINE } from '../../constants/messages';
import type { OfflineActionType } from '../../types/offline';

const ACTION_LABELS: Record<OfflineActionType, string> = {
  rating_upsert: 'Calificacion',
  rating_delete: 'Borrar calificacion',
  comment_create: 'Comentario',
  favorite_add: 'Agregar favorito',
  favorite_remove: 'Quitar favorito',
  price_level_upsert: 'Nivel de gasto',
  price_level_delete: 'Borrar nivel de gasto',
  tag_add: 'Agregar etiqueta',
  tag_remove: 'Quitar etiqueta',
  comment_like: 'Like',
  comment_unlike: 'Unlike',
  checkin_create: 'Check-in',
  checkin_delete: 'Deshacer check-in',
  follow_add: 'Seguir usuario',
  follow_remove: 'Dejar de seguir',
  recommendation_create: 'Recomendacion',
  recommendation_read: 'Marcar leida',
};

const ACTION_ICONS: Record<OfflineActionType, typeof StarOutlineIcon> = {
  rating_upsert: StarOutlineIcon,
  rating_delete: StarOutlineIcon,
  comment_create: ChatBubbleOutlineIcon,
  favorite_add: FavoriteIcon,
  favorite_remove: FavoriteIcon,
  price_level_upsert: AttachMoneyIcon,
  price_level_delete: AttachMoneyIcon,
  tag_add: LabelOutlinedIcon,
  tag_remove: LabelOutlinedIcon,
  comment_like: ChatBubbleOutlineIcon,
  comment_unlike: ChatBubbleOutlineIcon,
  checkin_create: PlaceOutlinedIcon,
  checkin_delete: PlaceOutlinedIcon,
  follow_add: PersonAddIcon,
  follow_remove: PersonAddIcon,
  recommendation_create: SendIcon,
  recommendation_read: SendIcon,
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export default memo(function PendingActionsSection() {
  const { pendingActions, discardAction, retryFailed } = useConnectivity();
  const [discarding, setDiscarding] = useState<string | null>(null);
  const hasFailed = pendingActions.some((a) => a.status === 'failed');

  if (pendingActions.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {MSG_OFFLINE.emptyPending}
        </Typography>
      </Box>
    );
  }

  const handleDiscard = async (id: string) => {
    setDiscarding(id);
    try {
      await discardAction(id);
    } finally {
      setDiscarding(null);
    }
  };

  return (
    <Box>
      {hasFailed && (
        <Box sx={{ px: 2, pt: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ReplayIcon />}
            onClick={() => retryFailed()}
            fullWidth
          >
            Reintentar fallidas
          </Button>
        </Box>
      )}
      <List dense>
        {pendingActions.map((action) => {
          const Icon = ACTION_ICONS[action.type];
          const isFailed = action.status === 'failed';
          return (
            <ListItem
              key={action.id}
              secondaryAction={
                <IconButton
                  edge="end"
                  size="small"
                  onClick={() => handleDiscard(action.id)}
                  disabled={discarding === action.id}
                  aria-label="Descartar"
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {isFailed ? (
                  <ErrorOutlineIcon color="error" fontSize="small" />
                ) : (
                  <Icon fontSize="small" color="action" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={`${ACTION_LABELS[action.type]}${action.businessName ? ` - ${action.businessName}` : ''}`}
                secondary={`${timeAgo(action.createdAt)}${isFailed ? ' - Fallo' : ''}`}
                primaryTypographyProps={{ fontSize: '0.85rem', color: isFailed ? 'error.main' : 'text.primary' }}
                secondaryTypographyProps={{ fontSize: '0.75rem' }}
              />
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
});
