import { useState, useMemo, useRef, useCallback, memo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  Divider,
  IconButton,
  Snackbar,
  Chip,
  Collapse,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { addComment, editComment, deleteComment, likeComment, unlikeComment } from '../../services/comments';
import CommentRow from './CommentRow';
import UserProfileSheet from '../user/UserProfileSheet';
import { useProfileVisibility } from '../../hooks/useProfileVisibility';
import { useUndoDelete } from '../../hooks/useUndoDelete';
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
  const toast = useToast();
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
  const onConfirmDeleteComment = useCallback(
    async (comment: Comment) => {
      if (!user) return;
      await deleteComment(comment.id, user.uid);
    },
    [user],
  );
  const { isPendingDelete, markForDelete: markCommentForDelete, snackbarProps: deleteSnackbarProps } = useUndoDelete<Comment>({
    onConfirmDelete: onConfirmDeleteComment,
    onDeleteComplete: onCommentsChange,
    message: 'Comentario eliminado',
  });

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
    const visible = topLevelComments.filter((c) => !isPendingDelete(c.id));

    return [...visible].sort((a, b) => {
      switch (sortMode) {
        case 'recent': return b.createdAt.getTime() - a.createdAt.getTime();
        case 'oldest': return a.createdAt.getTime() - b.createdAt.getTime();
        case 'useful': return b.likeCount - a.likeCount;
      }
    });
  }, [topLevelComments, sortMode, isPendingDelete]);

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
      toast.success('Comentario publicado');
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error adding comment:', error);
      toast.error('No se pudo publicar el comentario');
    }
    setIsSubmitting(false);
  };

  const handleStartEdit = useCallback((comment: Comment) => {
    setEditingId(comment.id);
    setEditText(comment.text);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText('');
  }, []);

  const handleSaveEdit = async () => {
    if (!editingId || !user || !editText.trim()) return;
    setIsSavingEdit(true);
    try {
      await editComment(editingId, user.uid, editText.trim());
      setEditingId(null);
      setEditText('');
      onCommentsChange();
      toast.success('Comentario editado');
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error editing comment:', error);
      toast.error('No se pudo editar el comentario');
    }
    setIsSavingEdit(false);
  };

  const handleDelete = useCallback((comment: Comment) => {
    markCommentForDelete(comment.id, comment);
  }, [markCommentForDelete]);

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
      toast.error('No se pudo actualizar el like');
    }
  };

  // Reply handlers
  const handleStartReply = useCallback((comment: Comment) => {
    setReplyingTo({ id: comment.id, userName: comment.userName });
    setReplyText('');
    // Auto-expand thread when replying
    setExpandedThreads((prev) => new Set(prev).add(comment.id));
    setTimeout(() => replyInputRef.current?.focus(), 100);
  }, []);

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
      toast.success('Respuesta publicada');
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error adding reply:', error);
      toast.error('No se pudo publicar la respuesta');
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

  const handleShowProfile = useCallback((userId: string, userName: string) => {
    setProfileUser({ id: userId, name: userName });
  }, []);

  const handleEditTextChange = useCallback((text: string) => {
    setEditText(text);
  }, []);

  const getReplyCount = (comment: Comment): number => {
    // Use denormalized count, but fall back to actual replies in local data
    const localReplies = repliesByParent.get(comment.id);
    return comment.replyCount ?? localReplies?.length ?? 0;
  };

  const renderCommentRow = (comment: Comment, isReply: boolean) => {
    if (isPendingDelete(comment.id)) return null;
    return (
      <CommentRow
        key={comment.id}
        comment={comment}
        isOwn={comment.userId === user?.uid}
        isLiked={isLiked(comment.id)}
        likeCount={getLikeCount(comment)}
        replyCount={isReply ? 0 : getReplyCount(comment)}
        isReply={isReply}
        isEditing={editingId === comment.id}
        editText={editText}
        isSavingEdit={isSavingEdit}
        isProfilePublic={profileVisibility.get(comment.userId) ?? false}
        onToggleLike={handleToggleLike}
        onStartEdit={handleStartEdit}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
        onEditTextChange={handleEditTextChange}
        onDelete={handleDelete}
        onReply={isReply ? undefined : handleStartReply}
        onShowProfile={handleShowProfile}
      />
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
              color: 'primary.contrastText',
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
          const visibleReplies = replies.filter((r) => !isPendingDelete(r.id));
          const pendingReplyDeletes = replies.filter((r) => isPendingDelete(r.id)).length;
          const replyCount = getReplyCount(comment) - pendingReplyDeletes;
          const isExpanded = expandedThreads.has(comment.id);

          return (
            <Box key={comment.id}>
              {renderCommentRow(comment, false)}

              {/* Thread: "Ver N respuestas" toggle + replies */}
              {replyCount > 0 && (
                <Box sx={{ pl: 5.5, mt: 0.5 }}>
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
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                      }}
                    >
                      {visibleReplies.map((reply) => renderCommentRow(reply, true))}
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
                        color: 'primary.contrastText',
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
                      sx={{ color: 'text.secondary', width: 32, height: 32, flexShrink: 0 }}
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
        open={deleteSnackbarProps.open}
        message={deleteSnackbarProps.message}
        autoHideDuration={deleteSnackbarProps.autoHideDuration}
        onClose={deleteSnackbarProps.onClose}
        action={
          <Button color="primary" size="small" onClick={deleteSnackbarProps.onUndo}>
            Deshacer
          </Button>
        }
      />

      <UserProfileSheet userId={profileUser?.id ?? null} {...(profileUser?.name != null && { userName: profileUser.name })} onClose={() => setProfileUser(null)} />
    </Box>
  );
});
