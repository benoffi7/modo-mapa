import { useState, useMemo, useRef, useCallback, useEffect, memo } from 'react';
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
  Alert,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConnectivity } from '../../hooks/useConnectivity';
import { addComment, editComment, deleteComment, likeComment, unlikeComment } from '../../services/comments';
import { withOfflineSupport } from '../../services/offlineInterceptor';
import CommentRow from './CommentRow';
import CommentInput from './CommentInput';
import UserProfileSheet from '../user/UserProfileSheet';
import { useProfileVisibility } from '../../hooks/useProfileVisibility';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import { useOptimisticLikes } from '../../hooks/useOptimisticLikes';
import { useCommentEdit } from '../../hooks/useCommentEdit';
import { useCommentThreads } from '../../hooks/useCommentThreads';
import { MAX_COMMENT_LENGTH, MAX_COMMENTS_PER_DAY } from '../../constants/validation';
import { STORAGE_KEY_HINT_POST_FIRST_COMMENT } from '../../constants/storage';
import { MSG_COMMENT } from '../../constants/messages';
import type { Comment } from '../../types';
import { logger } from '../../utils/logger';

type SortMode = 'recent' | 'oldest' | 'useful';

interface Props {
  businessId: string;
  businessName?: string;
  comments: Comment[];
  userCommentLikes: Set<string>;
  isLoading: boolean;
  onCommentsChange: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export default memo(function BusinessComments({ businessId, businessName, comments, userCommentLikes, isLoading, onCommentsChange, onDirtyChange }: Props) {
  const { user, displayName } = useAuth();
  const toast = useToast();
  const { isOffline } = useConnectivity();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileUser, setProfileUser] = useState<{ id: string; name: string } | null>(null);

  // Profile visibility
  const commentUserIds = useMemo(() => comments.map((c) => c.userId), [comments]);
  const profileVisibility = useProfileVisibility(commentUserIds);

  // Sort
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  // Edit (extracted hook)
  const handleEditSave = useCallback(async (commentId: string, newText: string) => {
    if (!user) return;
    await editComment(commentId, user.uid, newText);
    toast.success(MSG_COMMENT.editSuccess);
  }, [user, toast]);

  const { editingId, editText, isSavingEdit, setEditText, startEdit, cancelEdit, saveEdit } = useCommentEdit({
    onSave: handleEditSave,
    onSaveComplete: onCommentsChange,
  });

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

  // Optimistic likes (extracted hook)
  const toggleAction = useCallback(async (commentId: string, currentlyLiked: boolean) => {
    if (!user) return;
    if (currentlyLiked) {
      await withOfflineSupport(
        isOffline, 'comment_unlike',
        { userId: user.uid, businessId, businessName },
        { commentId },
        () => unlikeComment(user.uid, commentId),
        toast,
      );
    } else {
      await withOfflineSupport(
        isOffline, 'comment_like',
        { userId: user.uid, businessId, businessName },
        { commentId },
        () => likeComment(user.uid, commentId),
        toast,
      );
    }
  }, [user, isOffline, businessId, businessName, toast]);

  const { isLiked, getLikeCount, toggleLike } = useOptimisticLikes({
    userLikes: userCommentLikes,
    toggleAction,
  });

  // Track input text for dirty detection
  const [commentInputText, setCommentInputText] = useState('');

  // Reply state
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const replyInputRef = useRef<HTMLInputElement>(null);

  // Threads (extracted hook)
  const { topLevelComments, repliesByParent, expandedThreads, toggleThread, expandThread } = useCommentThreads(comments);

  // Notify parent of dirty state
  useEffect(() => {
    const isDirty =
      commentInputText.trim().length > 0 ||
      replyText.trim().length > 0 ||
      editText.trim().length > 0;
    onDirtyChange?.(isDirty);
  }, [commentInputText, replyText, editText, onDirtyChange]);

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

  // Handlers
  const handleSubmitText = async (text: string) => {
    if (!user) return;
    if (userCommentsToday >= MAX_COMMENTS_PER_DAY) return;
    setIsSubmitting(true);
    try {
      await withOfflineSupport(
        isOffline, 'comment_create',
        { userId: user.uid, businessId, businessName },
        { userName: displayName || 'Anónimo', text },
        () => addComment(user.uid, displayName || 'Anónimo', businessId, text),
        toast,
      );
      onCommentsChange();
      if (!isOffline) toast.success(MSG_COMMENT.publishSuccess);
      if (localStorage.getItem(STORAGE_KEY_HINT_POST_FIRST_COMMENT) !== 'true') {
        localStorage.setItem(STORAGE_KEY_HINT_POST_FIRST_COMMENT, 'true');
        toast.info(MSG_COMMENT.favoriteHint);
      }
    } catch (error) {
      if (import.meta.env.DEV) logger.error('Error adding comment:', error);
      toast.error(MSG_COMMENT.publishError);
    }
    setIsSubmitting(false);
  };

  const handleDelete = useCallback((comment: Comment) => {
    markCommentForDelete(comment.id, comment);
  }, [markCommentForDelete]);

  const handleToggleLike = async (commentId: string) => {
    if (!user) return;
    try {
      await toggleLike(commentId);
    } catch {
      if (import.meta.env.DEV) logger.error('Error toggling like');
      toast.error(MSG_COMMENT.likeError);
    }
  };

  // Reply handlers
  const handleStartReply = useCallback((comment: Comment) => {
    setReplyingTo({ id: comment.id, userName: comment.userName });
    setReplyText('');
    expandThread(comment.id);
    setTimeout(() => replyInputRef.current?.focus(), 100);
  }, [expandThread]);

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
  };

  const handleSubmitReply = async () => {
    if (!user || !replyingTo || !replyText.trim()) return;
    if (userCommentsToday >= MAX_COMMENTS_PER_DAY) return;
    setIsSubmitting(true);
    try {
      const trimmedReply = replyText.trim();
      await withOfflineSupport(
        isOffline, 'comment_create',
        { userId: user.uid, businessId, businessName },
        { userName: displayName || 'Anónimo', text: trimmedReply, parentId: replyingTo.id },
        () => addComment(user.uid, displayName || 'Anónimo', businessId, trimmedReply, replyingTo.id),
        toast,
      );
      setReplyingTo(null);
      setReplyText('');
      onCommentsChange();
      if (!isOffline) toast.success(MSG_COMMENT.replySuccess);
    } catch (error) {
      if (import.meta.env.DEV) logger.error('Error adding reply:', error);
      toast.error(MSG_COMMENT.replyError);
    }
    setIsSubmitting(false);
  };

  const handleShowProfile = useCallback((userId: string, userName: string) => {
    setProfileUser({ id: userId, name: userName });
  }, []);

  const handleEditTextChange = useCallback((text: string) => {
    setEditText(text);
  }, [setEditText]);

  const getReplyCount = (comment: Comment): number => {
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
        likeCount={getLikeCount(comment.id, comment.likeCount)}
        replyCount={isReply ? 0 : getReplyCount(comment)}
        isReply={isReply}
        isEditing={editingId === comment.id}
        editText={editText}
        isSavingEdit={isSavingEdit}
        isProfilePublic={profileVisibility.get(comment.userId) ?? false}
        onToggleLike={handleToggleLike}
        onStartEdit={startEdit}
        onSaveEdit={saveEdit}
        onCancelEdit={cancelEdit}
        onEditTextChange={handleEditTextChange}
        onDelete={handleDelete}
        onReply={isReply ? undefined : handleStartReply}
        onShowProfile={handleShowProfile}
      />
    );
  };

  const topLevelCount = topLevelComments.length;

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} aria-live="polite" aria-atomic="true">
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
        <CommentInput
          userCommentsToday={userCommentsToday}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmitText}
          onTextChange={setCommentInputText}
        />
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

              {replyingTo?.id === comment.id && userCommentsToday >= MAX_COMMENTS_PER_DAY && (
                <Box sx={{ pl: 5.5, pr: 1, pb: 1 }}>
                  <Alert severity="info" variant="outlined" sx={{ fontSize: '0.8rem', borderRadius: '12px' }}>
                    Alcanzaste el límite diario de comentarios.
                  </Alert>
                </Box>
              )}
              {replyingTo?.id === comment.id && userCommentsToday < MAX_COMMENTS_PER_DAY && (
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
                          borderRadius: '12px',
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
