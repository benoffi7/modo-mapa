import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import {
  Box,
  Typography,
  Button,
  List,
  Divider,
  IconButton,
  Snackbar,
  Chip,
  Collapse,
  Alert,
  TextField,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import { useToast } from '../../context/ToastContext';
import { addComment, editComment } from '../../services/comments';
import { withOfflineSupport } from '../../services/offlineInterceptor';
import { useCommentListBase } from '../../hooks/useCommentListBase';
import CommentRow from './CommentRow';
import CommentInput from './CommentInput';
import UserProfileSheet from '../user/UserProfileSheet';
import { MAX_COMMENT_LENGTH, MAX_COMMENTS_PER_DAY } from '../../constants/validation';
import { STORAGE_KEY_HINT_POST_FIRST_COMMENT } from '../../constants/storage';
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
  // Thread state (needed by useCommentListBase for expandThread)
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const expandThread = useCallback((id: string) => {
    setExpandedThreads((prev) => new Set(prev).add(id));
  }, []);

  const base = useCommentListBase({
    businessId,
    businessName,
    comments,
    userCommentLikes,
    onCommentsChange,
    deleteMessage: 'Comentario eliminado',
    expandThread,
  });

  const {
    user, displayName, isOffline,
    profileVisibility, isPendingDelete, handleDelete, deleteSnackbarProps,
    isLiked, getLikeCount, handleToggleLike,
    replyingTo, replyText, replyInputRef, setReplyText,
    handleStartReply, handleCancelReply, handleSubmitReply,
    isSubmitting, profileUser, handleShowProfile, closeProfile,
    userCommentsToday,
  } = base;

  // Sort
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Track input text for dirty detection
  const [commentInputText, setCommentInputText] = useState('');

  // Notify parent of dirty state
  useEffect(() => {
    const isDirty =
      commentInputText.trim().length > 0 ||
      replyText.trim().length > 0 ||
      editText.trim().length > 0;
    onDirtyChange?.(isDirty);
  }, [commentInputText, replyText, editText, onDirtyChange]);

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

    for (const [key, arr] of replies) {
      replies.set(key, arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
    }

    return { topLevelComments: topLevel, repliesByParent: replies };
  }, [comments]);

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

  // Toast for component-specific messages (submit comment, edit)
  const toast = useToast();

  const handleSubmitText = async (text: string) => {
    if (!user) return;
    if (userCommentsToday >= MAX_COMMENTS_PER_DAY) return;
    try {
      await withOfflineSupport(
        isOffline, 'comment_create',
        { userId: user.uid, businessId, businessName },
        { userName: displayName || 'Anónimo', text },
        () => addComment(user.uid, displayName || 'Anónimo', businessId, text),
        toast,
      );
      onCommentsChange();
      if (!isOffline) toast.success('Comentario publicado');
      if (localStorage.getItem(STORAGE_KEY_HINT_POST_FIRST_COMMENT) !== 'true') {
        localStorage.setItem(STORAGE_KEY_HINT_POST_FIRST_COMMENT, 'true');
        toast.info('Guarda tus favoritos tocando el corazon.');
      }
    } catch (error) {
      if (import.meta.env.DEV) logger.error('Error adding comment:', error);
      toast.error('No se pudo publicar el comentario');
    }
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
      if (import.meta.env.DEV) logger.error('Error editing comment:', error);
      toast.error('No se pudo editar el comentario');
    }
    setIsSavingEdit(false);
  };

  const handleEditTextChange = useCallback((text: string) => {
    setEditText(text);
  }, []);

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

      <UserProfileSheet userId={profileUser?.id ?? null} {...(profileUser?.name != null && { userName: profileUser.name })} onClose={closeProfile} />
    </Box>
  );
});
