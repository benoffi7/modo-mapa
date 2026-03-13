import { useState, useMemo, useRef, useCallback, memo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Divider,
  IconButton,
  Snackbar,
  Chip,
  Collapse,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ReplyIcon from '@mui/icons-material/Reply';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useAuth } from '../../context/AuthContext';
import { addComment, editComment, deleteComment, likeComment, unlikeComment } from '../../services/comments';
import { formatDateMedium } from '../../utils/formatDate';
import UserProfileSheet from '../user/UserProfileSheet';
import { useProfileVisibility } from '../../hooks/useProfileVisibility';
import { MAX_COMMENT_LENGTH, MAX_COMMENTS_PER_DAY } from '../../constants/validation';
import type { Comment } from '../../types';

type SortMode = 'recent' | 'oldest' | 'useful';

interface Props {
  businessId: string;
  comments: Comment[];
  userCommentLikes: Set<string>;
  isLoading: boolean;
  onCommentsChange: () => void;
}

export default memo(function BusinessComments({ businessId, comments, userCommentLikes, isLoading, onCommentsChange }: Props) {
  const { user, displayName } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileUser, setProfileUser] = useState<{ id: string; name: string } | null>(null);

  // Profile visibility
  const commentUserIds = useMemo(() => comments.map((c) => c.userId), [comments]);
  const profileVisibility = useProfileVisibility(commentUserIds);

  // Sort
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Undo delete
  const [pendingDelete, setPendingDelete] = useState<Comment | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Optimistic likes
  const [optimisticLikeToggle, setOptimisticLikeToggle] = useState<Map<string, boolean>>(new Map());
  const [optimisticLikeDelta, setOptimisticLikeDelta] = useState<Map<string, number>>(new Map());

  // Reply state
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const replyInputRef = useRef<HTMLInputElement>(null);

  // Group comments: top-level and replies
  const { topLevelComments, repliesByParent } = useMemo(() => {
    const topLevel: Comment[] = [];
    const replies = new Map<string, Comment[]>();

    for (const c of comments) {
      if (c.parentId) {
        const existing = replies.get(c.parentId) ?? [];
        existing.push(c);
        replies.set(c.parentId, existing);
      } else {
        topLevel.push(c);
      }
    }

    // Sort replies chronologically
    for (const [key, arr] of replies) {
      replies.set(key, arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
    }

    return { topLevelComments: topLevel, repliesByParent: replies };
  }, [comments]);

  const userCommentsToday = comments.filter((c) => {
    if (c.userId !== user?.uid) return false;
    const today = new Date();
    return c.createdAt.toDateString() === today.toDateString();
  }).length;

  // Sorted top-level comments only
  const sortedTopLevel = useMemo(() => {
    const visible = pendingDelete
      ? topLevelComments.filter((c) => c.id !== pendingDelete.id)
      : topLevelComments;

    return [...visible].sort((a, b) => {
      switch (sortMode) {
        case 'recent': return b.createdAt.getTime() - a.createdAt.getTime();
        case 'oldest': return a.createdAt.getTime() - b.createdAt.getTime();
        case 'useful': return b.likeCount - a.likeCount;
      }
    });
  }, [topLevelComments, sortMode, pendingDelete]);

  // Helpers for optimistic likes
  const isLiked = useCallback((commentId: string) => {
    const toggled = optimisticLikeToggle.get(commentId);
    if (toggled !== undefined) return toggled;
    return userCommentLikes.has(commentId);
  }, [userCommentLikes, optimisticLikeToggle]);

  const getLikeCount = useCallback((comment: Comment) => {
    const delta = optimisticLikeDelta.get(comment.id) ?? 0;
    return Math.max(0, comment.likeCount + delta);
  }, [optimisticLikeDelta]);

  // Handlers
  const handleSubmit = async () => {
    if (!user || !newComment.trim()) return;
    if (userCommentsToday >= MAX_COMMENTS_PER_DAY) return;
    setIsSubmitting(true);
    try {
      await addComment(user.uid, displayName || 'Anónimo', businessId, newComment.trim());
      setNewComment('');
      onCommentsChange();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error adding comment:', error);
    }
    setIsSubmitting(false);
  };

  const handleStartEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditText(comment.text);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !user || !editText.trim()) return;
    setIsSavingEdit(true);
    try {
      await editComment(editingId, user.uid, editText.trim());
      setEditingId(null);
      setEditText('');
      onCommentsChange();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error editing comment:', error);
    }
    setIsSavingEdit(false);
  };

  const handleDelete = (comment: Comment) => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);

    setPendingDelete(comment);
    deleteTimerRef.current = setTimeout(async () => {
      if (!user) return;
      try {
        await deleteComment(comment.id, user.uid, comment.parentId);
        onCommentsChange();
      } catch (error) {
        if (import.meta.env.DEV) console.error('Error deleting comment:', error);
      }
      setPendingDelete(null);
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setPendingDelete(null);
  };

  const handleToggleLike = async (commentId: string) => {
    if (!user) return;
    const currentlyLiked = isLiked(commentId);

    // Optimistic update
    setOptimisticLikeToggle((prev) => new Map(prev).set(commentId, !currentlyLiked));
    setOptimisticLikeDelta((prev) => {
      const current = prev.get(commentId) ?? 0;
      return new Map(prev).set(commentId, currentlyLiked ? current - 1 : current + 1);
    });

    try {
      if (currentlyLiked) {
        await unlikeComment(user.uid, commentId);
      } else {
        await likeComment(user.uid, commentId);
      }
    } catch (error) {
      // Revert optimistic update
      setOptimisticLikeToggle((prev) => {
        const next = new Map(prev);
        next.delete(commentId);
        return next;
      });
      setOptimisticLikeDelta((prev) => {
        const next = new Map(prev);
        next.delete(commentId);
        return next;
      });
      if (import.meta.env.DEV) console.error('Error toggling like:', error);
    }
  };

  // Reply handlers
  const handleStartReply = (comment: Comment) => {
    setReplyingTo({ id: comment.id, userName: comment.userName });
    setReplyText('');
    // Auto-expand thread when replying
    setExpandedThreads((prev) => new Set(prev).add(comment.id));
    setTimeout(() => replyInputRef.current?.focus(), 100);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
  };

  const handleSubmitReply = async () => {
    if (!user || !replyingTo || !replyText.trim()) return;
    if (userCommentsToday >= MAX_COMMENTS_PER_DAY) return;
    setIsSubmitting(true);
    try {
      await addComment(user.uid, displayName || 'Anónimo', businessId, replyText.trim(), replyingTo.id);
      setReplyingTo(null);
      setReplyText('');
      onCommentsChange();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error adding reply:', error);
    }
    setIsSubmitting(false);
  };

  const toggleThread = (commentId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const getReplyCount = (comment: Comment): number => {
    // Use denormalized count, but fall back to actual replies in local data
    const localReplies = repliesByParent.get(comment.id);
    return comment.replyCount ?? localReplies?.length ?? 0;
  };

  // Render a single comment row (used for both top-level and replies)
  const renderComment = (comment: Comment, isReply: boolean) => {
    // If this comment is pending delete, skip rendering
    if (pendingDelete?.id === comment.id) return null;

    // Deleted parent placeholder
    const isDeletedParent = !comment.text && !comment.userName;

    return (
      <ListItem
        key={comment.id}
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
            bgcolor: '#1a73e8',
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
                ...(profileVisibility.get(comment.userId) ? {
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' },
                } : {}),
              }}
              onClick={() => profileVisibility.get(comment.userId) && setProfileUser({ id: comment.userId, name: comment.userName })}
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

          {editingId === comment.id ? (
            <Box sx={{ mt: 0.5 }}>
              <TextField
                fullWidth
                size="small"
                multiline
                maxRows={4}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                slotProps={{ htmlInput: { maxLength: MAX_COMMENT_LENGTH } }}
                helperText={`${editText.length}/${MAX_COMMENT_LENGTH}`}
              />
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit || !editText.trim()}
                  aria-label="Guardar edición"
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={handleCancelEdit} disabled={isSavingEdit} aria-label="Cancelar edición">
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

          {/* Action buttons row: like + reply count + reply button */}
          {editingId !== comment.id && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, gap: 1 }}>
              {/* Like button (not for own comments) */}
              {user && comment.userId !== user.uid && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <IconButton
                    size="small"
                    onClick={() => handleToggleLike(comment.id)}
                    sx={{ color: isLiked(comment.id) ? '#e91e63' : 'text.secondary', p: 0.5 }}
                    aria-label={isLiked(comment.id) ? 'Quitar like' : 'Dar like'}
                  >
                    {isLiked(comment.id) ? <FavoriteIcon sx={{ fontSize: 16 }} /> : <FavoriteBorderIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                  {getLikeCount(comment) > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 0.25 }}>
                      {getLikeCount(comment)}
                    </Typography>
                  )}
                </Box>
              )}
              {/* Show like count for own comments (read-only) */}
              {user && comment.userId === user.uid && getLikeCount(comment) > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FavoriteIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.disabled" sx={{ ml: 0.25 }}>
                    {getLikeCount(comment)}
                  </Typography>
                </Box>
              )}

              {/* Reply count indicator (top-level only) */}
              {!isReply && getReplyCount(comment) > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <ChatBubbleOutlineIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 0.25 }}>
                    {getReplyCount(comment)}
                  </Typography>
                </Box>
              )}

              {/* Reply button (top-level only, for logged-in users) */}
              {!isReply && user && (
                <Button
                  size="small"
                  startIcon={<ReplyIcon sx={{ fontSize: 14 }} />}
                  onClick={() => handleStartReply(comment)}
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
        {user && comment.userId === user.uid && editingId !== comment.id && (
          <Box sx={{ display: 'flex', flexDirection: 'column', ml: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => handleStartEdit(comment)}
              sx={{ color: '#5f6368' }}
              aria-label="Editar comentario"
            >
              <EditOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleDelete(comment)}
              sx={{ color: '#5f6368' }}
              aria-label="Eliminar comentario"
            >
              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}
      </ListItem>
    );
  };

  // Count only top-level comments for the header
  const topLevelCount = topLevelComments.length;

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Comentarios ({isLoading ? '...' : topLevelCount})
        </Typography>
        {topLevelCount > 1 && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {(['recent', 'oldest', 'useful'] as const).map((mode) => (
              <Chip
                key={mode}
                label={mode === 'recent' ? 'Recientes' : mode === 'oldest' ? 'Antiguos' : 'Útiles'}
                size="small"
                variant={sortMode === mode ? 'filled' : 'outlined'}
                color={sortMode === mode ? 'primary' : 'default'}
                onClick={() => setSortMode(mode)}
                sx={{ height: 24, fontSize: '0.7rem' }}
              />
            ))}
          </Box>
        )}
      </Box>

      {user && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Dejá tu comentario..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            slotProps={{ htmlInput: { maxLength: MAX_COMMENT_LENGTH } }}
            helperText={newComment.length > 0 ? `${newComment.length}/${MAX_COMMENT_LENGTH}` : undefined}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '20px',
              },
            }}
          />
          <IconButton
            color="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !newComment.trim()}
            sx={{
              bgcolor: 'primary.main',
              color: '#fff',
              width: 40,
              height: 40,
              flexShrink: 0,
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
            }}
          >
            <SendIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      )}

      <List disablePadding>
        {sortedTopLevel.map((comment, index) => {
          const replies = repliesByParent.get(comment.id) ?? [];
          const visibleReplies = replies.filter((r) => r.id !== pendingDelete?.id);
          const replyCount = getReplyCount(comment);
          const isExpanded = expandedThreads.has(comment.id);

          return (
            <Box key={comment.id}>
              {renderComment(comment, false)}

              {/* Thread: "Ver N respuestas" toggle + replies */}
              {replyCount > 0 && (
                <Box sx={{ pl: 5.5 }}>
                  <Button
                    size="small"
                    onClick={() => toggleThread(comment.id)}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.75rem',
                      color: 'primary.main',
                      fontWeight: 600,
                      p: '2px 6px',
                    }}
                  >
                    {isExpanded
                      ? 'Ocultar respuestas'
                      : replyCount === 1
                        ? 'Ver 1 respuesta'
                        : `Ver ${replyCount} respuestas`}
                  </Button>
                  <Collapse in={isExpanded}>
                    <Box
                      sx={{
                        borderLeft: 2,
                        borderColor: 'divider',
                        ml: 0.5,
                        pl: 1,
                      }}
                    >
                      {visibleReplies.map((reply) => renderComment(reply, true))}
                    </Box>
                  </Collapse>
                </Box>
              )}

              {/* Inline reply form */}
              {replyingTo?.id === comment.id && (
                <Box sx={{ pl: 5.5, pr: 1, pb: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Respondiendo a {replyingTo.userName}...
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                      inputRef={replyInputRef}
                      fullWidth
                      size="small"
                      placeholder="Escribí tu respuesta..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitReply();
                        }
                        if (e.key === 'Escape') {
                          handleCancelReply();
                        }
                      }}
                      slotProps={{ htmlInput: { maxLength: MAX_COMMENT_LENGTH } }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '16px',
                        },
                      }}
                    />
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={handleSubmitReply}
                      disabled={isSubmitting || !replyText.trim()}
                      sx={{
                        bgcolor: 'primary.main',
                        color: '#fff',
                        width: 32,
                        height: 32,
                        flexShrink: 0,
                        '&:hover': { bgcolor: 'primary.dark' },
                        '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
                      }}
                    >
                      <SendIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={handleCancelReply}
                      sx={{ color: '#5f6368', width: 32, height: 32, flexShrink: 0 }}
                      aria-label="Cancelar respuesta"
                    >
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>
              )}

              {index < sortedTopLevel.length - 1 && <Divider />}
            </Box>
          );
        })}
        {!isLoading && topLevelCount === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            Sé el primero en comentar
          </Typography>
        )}
      </List>

      <Snackbar
        open={pendingDelete !== null}
        message="Comentario eliminado"
        action={
          <Button color="primary" size="small" onClick={handleUndoDelete}>
            Deshacer
          </Button>
        }
      />

      <UserProfileSheet userId={profileUser?.id ?? null} {...(profileUser?.name != null && { userName: profileUser.name })} onClose={() => setProfileUser(null)} />
    </Box>
  );
});
