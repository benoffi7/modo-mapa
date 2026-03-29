import { memo } from 'react';
import {
  Box,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  TextField,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CloseIcon from '@mui/icons-material/Close';
import { useSwipeActions } from '../../hooks/useSwipeActions';
import { MAX_COMMENT_LENGTH } from '../../constants/validation';
import { formatRelativeTime } from '../../utils/formatDate';
import { truncate } from '../../utils/text';
import type { Business, Comment } from '../../types';

export interface CommentItemProps {
  id: string;
  comment: Comment;
  business: Business | null;
  editingId: string | null;
  editText: string;
  isSavingEdit: boolean;
  swipe: ReturnType<typeof useSwipeActions>;
  getSwipeRef: (id: string) => React.RefObject<HTMLElement | null>;
  unreadReplyCommentIds: Set<string>;
  onSelectBusiness: (business: Business | null, commentId?: string) => void;
  onStartEdit: (comment: Comment) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onSetEditText: (text: string) => void;
  onMarkForDelete: (id: string, comment: Comment) => void;
}

const CommentItem = memo(function CommentItem({
  id, comment, business, editingId, editText, isSavingEdit,
  swipe, getSwipeRef, unreadReplyCommentIds,
  onSelectBusiness, onStartEdit, onSaveEdit, onCancelEdit, onSetEditText, onMarkForDelete,
}: CommentItemProps) {
  const isSwiped = swipe.swipedId === id;
  const itemRef = getSwipeRef(id);
  // eslint-disable-next-line react-hooks/refs -- ref is only read inside touch event callbacks, not during render
  const handlers = swipe.getHandlers(id, itemRef);
  const style = swipe.getStyle(id);

  return (
    <Box
      sx={{ position: 'relative', overflow: 'hidden' }}
      onClick={() => isSwiped && swipe.reset()}
    >
      {isSwiped && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(swipe.direction === 'left'
              ? { right: 0, bgcolor: 'error.main' }
              : { left: 0, bgcolor: 'primary.main' }),
            width: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconButton
            sx={{ color: 'common.white' }}
            onClick={(e) => {
              e.stopPropagation();
              if (swipe.direction === 'left') {
                onMarkForDelete(id, comment);
              } else {
                onStartEdit(comment);
              }
              swipe.reset();
            }}
            aria-label={swipe.direction === 'left' ? 'Eliminar' : 'Editar'}
          >
            {swipe.direction === 'left'
              ? <DeleteOutlineIcon />
              : <EditOutlinedIcon />}
          </IconButton>
        </Box>
      )}

      <Box
        ref={itemRef}
        {...handlers}
        sx={{
          position: 'relative',
          bgcolor: 'background.paper',
          zIndex: 1,
        }}
        style={style}
      >
        <ListItemButton
          onClick={() => editingId !== id && !isSwiped && onSelectBusiness(business, id)}
          disabled={!business && editingId !== id}
          sx={{ pr: 1, alignItems: 'flex-start' }}
        >
          <ListItemText
            primary={business?.name || 'Comercio desconocido'}
            secondary={
              editingId === id ? (
                <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    maxRows={4}
                    value={editText}
                    onChange={(e) => onSetEditText(e.target.value)}
                    disabled={isSavingEdit}
                    slotProps={{ htmlInput: { maxLength: MAX_COMMENT_LENGTH } }}
                    helperText={`${editText.length}/${MAX_COMMENT_LENGTH}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Box component="span" sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={(e) => { e.stopPropagation(); onSaveEdit(); }}
                      disabled={isSavingEdit || !editText.trim()}
                      aria-label="Guardar edición"
                    >
                      <CheckIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); onCancelEdit(); }}
                      disabled={isSavingEdit}
                      aria-label="Cancelar edición"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ) : (
                <>
                  {comment.type === 'question' && (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, mb: 0.25 }}>
                      <HelpOutlineIcon sx={{ fontSize: 13, color: 'info.main' }} />
                      <Typography component="span" variant="caption" color="info.main" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
                        Pregunta
                      </Typography>
                    </Box>
                  )}
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', display: 'block' }}>
                    {truncate(comment.text, 80)}
                  </Typography>
                  <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.25, flexWrap: 'wrap' }}>
                    <Typography component="span" variant="caption" color="text.secondary">
                      {formatRelativeTime(comment.createdAt)}
                    </Typography>
                    {comment.updatedAt && (
                      <Typography component="span" variant="caption" color="text.disabled">
                        (editado)
                      </Typography>
                    )}
                    {comment.likeCount > 0 && (
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                        <FavoriteIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                        <Typography component="span" variant="caption" color="text.disabled" aria-live="polite" aria-atomic="true">
                          {comment.likeCount}
                        </Typography>
                      </Box>
                    )}
                    {(comment.replyCount ?? 0) > 0 && (
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                        {unreadReplyCommentIds.has(comment.id) && (
                          <Box
                            component="span"
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor: 'info.main',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <ChatBubbleOutlineIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                        <Typography component="span" variant="caption" color="text.secondary">
                          {comment.replyCount}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </>
              )
            }
            primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }}
          />
          {editingId !== id && (
            <Box sx={{ display: 'flex', flexDirection: 'column', ml: 0.5 }}>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onStartEdit(comment); }}
                sx={{ color: 'text.secondary' }}
                aria-label="Editar comentario"
              >
                <EditOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onMarkForDelete(id, comment); }}
                sx={{ color: 'text.secondary' }}
                aria-label="Eliminar comentario"
              >
                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          )}
        </ListItemButton>
      </Box>
    </Box>
  );
});

export default CommentItem;
