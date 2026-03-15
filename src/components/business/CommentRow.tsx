import { memo } from 'react';
import {
  Box,
  Typography,
  TextField,
  ListItem,
  ListItemText,
  Avatar,
  IconButton,
  Button,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ReplyIcon from '@mui/icons-material/Reply';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { formatDateMedium } from '../../utils/formatDate';
import { LIKE_COLOR } from '../../constants/ui';
import { MAX_COMMENT_LENGTH } from '../../constants/validation';
import type { Comment } from '../../types';

export interface CommentRowProps {
  comment: Comment;
  isOwn: boolean;
  isLiked: boolean;
  likeCount: number;
  replyCount: number;
  isReply?: boolean;
  isEditing: boolean;
  editText: string;
  isSavingEdit: boolean;
  isProfilePublic: boolean;
  onToggleLike: (commentId: string) => void;
  onStartEdit: (comment: Comment) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
  onDelete: (comment: Comment) => void;
  onReply?: ((comment: Comment) => void) | undefined;
  onShowProfile?: ((userId: string, userName: string) => void) | undefined;
}

const CommentRow = memo(function CommentRow({
  comment,
  isOwn,
  isLiked,
  likeCount,
  replyCount,
  isReply = false,
  isEditing,
  editText,
  isSavingEdit,
  isProfilePublic,
  onToggleLike,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditTextChange,
  onDelete,
  onReply,
  onShowProfile,
}: CommentRowProps) {
  const isDeletedParent = !comment.text && !comment.userName;

  return (
    <ListItem
      alignItems="flex-start"
      disablePadding
      sx={{
        py: 1,
        ...(isReply ? { pl: 2 } : {}),
      }}
    >
      <Avatar
        sx={{
          width: isReply ? 26 : 32,
          height: isReply ? 26 : 32,
          mr: 1.5,
          mt: 0.5,
          fontSize: isReply ? '0.75rem' : '0.85rem',
          bgcolor: 'primary.main',
        }}
      >
        {(comment.userName || 'A').charAt(0).toUpperCase()}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography
            component="span"
            variant="body2"
            sx={{
              fontWeight: 600,
              fontSize: isReply ? '0.8rem' : undefined,
              ...(isProfilePublic ? {
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' },
              } : {}),
            }}
            onClick={() => isProfilePublic && onShowProfile?.(comment.userId, comment.userName)}
          >
            {isDeletedParent ? 'Comentario eliminado' : (comment.userName || 'Anónimo')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDateMedium(comment.createdAt)}
          </Typography>
          {comment.updatedAt && (
            <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
              (editado)
            </Typography>
          )}
        </Box>

        {isEditing ? (
          <Box sx={{ mt: 0.5 }}>
            <TextField
              fullWidth
              size="small"
              multiline
              maxRows={4}
              value={editText}
              onChange={(e) => onEditTextChange(e.target.value)}
              disabled={isSavingEdit}
              slotProps={{ htmlInput: { maxLength: MAX_COMMENT_LENGTH } }}
              helperText={`${editText.length}/${MAX_COMMENT_LENGTH}`}
            />
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
              <IconButton
                size="small"
                color="primary"
                onClick={onSaveEdit}
                disabled={isSavingEdit || !editText.trim()}
                aria-label="Guardar edición"
              >
                <CheckIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={onCancelEdit} disabled={isSavingEdit} aria-label="Cancelar edición">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        ) : (
          <ListItemText
            secondary={comment.text}
            slotProps={{ secondary: { component: 'span', display: 'block', ...(isReply ? { fontSize: '0.8rem' } : {}) } }}
            sx={{ m: 0 }}
          />
        )}

        {/* Action buttons row */}
        {!isEditing && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, gap: 1 }}>
            {/* Like button (not for own comments) */}
            {!isOwn && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton
                  size="small"
                  onClick={() => onToggleLike(comment.id)}
                  sx={{ color: isLiked ? LIKE_COLOR : 'text.secondary', p: 0.5 }}
                  aria-label={isLiked ? 'Quitar like' : 'Dar like'}
                >
                  {isLiked ? <FavoriteIcon sx={{ fontSize: 16 }} /> : <FavoriteBorderIcon sx={{ fontSize: 16 }} />}
                </IconButton>
                {likeCount > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 0.25 }}>
                    {likeCount}
                  </Typography>
                )}
              </Box>
            )}
            {/* Show like count for own comments (read-only) */}
            {isOwn && likeCount > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FavoriteIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.disabled" sx={{ ml: 0.25 }}>
                  {likeCount}
                </Typography>
              </Box>
            )}

            {/* Reply count indicator (top-level only) */}
            {!isReply && replyCount > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ChatBubbleOutlineIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 0.25 }}>
                  {replyCount}
                </Typography>
              </Box>
            )}

            {/* Reply button (top-level only) */}
            {!isReply && onReply && (
              <Button
                size="small"
                startIcon={<ReplyIcon sx={{ fontSize: 14 }} />}
                onClick={() => onReply(comment)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  minWidth: 'auto',
                  p: '2px 6px',
                }}
              >
                Responder
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Edit + Delete buttons for own comments */}
      {isOwn && !isEditing && (
        <Box sx={{ display: 'flex', flexDirection: 'column', ml: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => onStartEdit(comment)}
            sx={{ color: 'text.secondary' }}
            aria-label="Editar comentario"
          >
            <EditOutlinedIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onDelete(comment)}
            sx={{ color: 'text.secondary' }}
            aria-label="Eliminar comentario"
          >
            <DeleteOutlineIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      )}
    </ListItem>
  );
});

export default CommentRow;
