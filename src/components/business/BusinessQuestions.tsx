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
  Collapse,
  Alert,
  Chip,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConnectivity } from '../../hooks/useConnectivity';
import { createQuestion, addComment, deleteComment, likeComment, unlikeComment } from '../../services/comments';
import { withOfflineSupport } from '../../services/offlineInterceptor';
import CommentRow from './CommentRow';
import QuestionInput from './QuestionInput';
import UserProfileSheet from '../user/UserProfileSheet';
import { useProfileVisibility } from '../../hooks/useProfileVisibility';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import { useOptimisticLikes } from '../../hooks/useOptimisticLikes';
import { useQuestionThreads } from './useQuestionThreads';
import { BEST_ANSWER_MIN_LIKES } from '../../constants/questions';
import { MAX_COMMENT_LENGTH, MAX_COMMENTS_PER_DAY } from '../../constants/validation';
import { trackEvent } from '../../utils/analytics';
import type { Comment } from '../../types';
import { MSG_QUESTION } from '../../constants/messages';
import { logger } from '../../utils/logger';

interface Props {
  businessId: string;
  businessName?: string;
  comments: Comment[];
  userCommentLikes: Set<string>;
  isLoading: boolean;
  onCommentsChange: () => void;
}

export default memo(function BusinessQuestions({ businessId, businessName, comments, userCommentLikes, isLoading, onCommentsChange }: Props) {
  const { user, displayName } = useAuth();
  const toast = useToast();
  const { isOffline } = useConnectivity();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [profileUser, setProfileUser] = useState<{ id: string; name: string } | null>(null);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const replyInputRef = useRef<HTMLInputElement>(null);

  // Profile visibility
  const commentUserIds = useMemo(() => comments.map((c) => c.userId), [comments]);
  const profileVisibility = useProfileVisibility(commentUserIds);

  // Undo delete
  const onConfirmDelete = useCallback(
    async (comment: Comment) => {
      if (!user) return;
      await deleteComment(comment.id, user.uid);
    },
    [user],
  );
  const { isPendingDelete, markForDelete, snackbarProps: deleteSnackbarProps } = useUndoDelete<Comment>({
    onConfirmDelete,
    onDeleteComplete: onCommentsChange,
    message: 'Pregunta eliminada',
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

  // Question threads (extracted hook)
  const { questions, answersByQuestion, expandedQuestions, toggleQuestion, expandQuestion, getAnswerCount } =
    useQuestionThreads(comments, businessId);

  const userCommentsToday = useMemo(() => {
    const today = new Date().toDateString();
    return comments.filter((c) => c.userId === user?.uid && c.createdAt.toDateString() === today).length;
  }, [comments, user?.uid]);

  // Handlers
  const handleSubmitQuestion = async () => {
    if (!user || !questionText.trim()) return;
    if (userCommentsToday >= MAX_COMMENTS_PER_DAY) return;
    setIsSubmitting(true);
    try {
      await withOfflineSupport(
        isOffline, 'comment_create',
        { userId: user.uid, businessId, businessName },
        { userName: displayName || 'Anónimo', text: questionText.trim(), questionType: true },
        () => createQuestion(user.uid, displayName || 'Anónimo', businessId, questionText.trim()),
        toast,
      );
      setQuestionText('');
      onCommentsChange();
      if (!isOffline) toast.success(MSG_QUESTION.publishSuccess);
    } catch (error) {
      if (import.meta.env.DEV) logger.error('Error creating question:', error);
      toast.error(MSG_QUESTION.publishError);
    }
    setIsSubmitting(false);
  };

  const handleToggleLike = async (commentId: string) => {
    if (!user) return;
    try {
      await toggleLike(commentId);
    } catch {
      if (import.meta.env.DEV) logger.error('Error toggling like');
      toast.error(MSG_QUESTION.likeError);
    }
  };

  const handleDelete = useCallback((comment: Comment) => {
    markForDelete(comment.id, comment);
  }, [markForDelete]);

  const handleStartReply = useCallback((comment: Comment) => {
    setReplyingTo({ id: comment.id, userName: comment.userName });
    setReplyText('');
    expandQuestion(comment.id);
    setTimeout(() => replyInputRef.current?.focus(), 100);
  }, [expandQuestion]);

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
  };

  const handleSubmitReply = async () => {
    if (!user || !replyingTo || !replyText.trim()) return;
    if (userCommentsToday >= MAX_COMMENTS_PER_DAY) return;
    setIsSubmitting(true);
    try {
      await withOfflineSupport(
        isOffline, 'comment_create',
        { userId: user.uid, businessId, businessName },
        { userName: displayName || 'Anónimo', text: replyText.trim(), parentId: replyingTo.id },
        () => addComment(user.uid, displayName || 'Anónimo', businessId, replyText.trim(), replyingTo.id),
        toast,
      );
      setReplyingTo(null);
      setReplyText('');
      onCommentsChange();
      if (!isOffline) toast.success(MSG_QUESTION.replySuccess);
      trackEvent('question_answered', { business_id: businessId, question_id: replyingTo.id });
    } catch (error) {
      if (import.meta.env.DEV) logger.error('Error adding answer:', error);
      toast.error(MSG_QUESTION.replyError);
    }
    setIsSubmitting(false);
  };

  const handleShowProfile = useCallback((userId: string, userName: string) => {
    setProfileUser({ id: userId, name: userName });
  }, []);

  // No-op handlers for CommentRow edit props (questions don't support inline edit)
  const noopEdit = useCallback(() => {}, []);
  const noopEditText = useCallback(() => {}, []);

  const visibleQuestions = useMemo(
    () => questions.filter((q) => !isPendingDelete(q.id)),
    [questions, isPendingDelete],
  );

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <HelpOutlineIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} aria-live="polite" aria-atomic="true">
          Preguntas ({isLoading ? '...' : visibleQuestions.length})
        </Typography>
      </Box>

      {user && (
        <QuestionInput
          questionText={questionText}
          onQuestionTextChange={setQuestionText}
          onSubmit={handleSubmitQuestion}
          isSubmitting={isSubmitting}
          userCommentsToday={userCommentsToday}
        />
      )}

      <List disablePadding>
        {visibleQuestions.map((question, index) => {
          const answers = answersByQuestion.get(question.id) ?? [];
          const visibleAnswers = answers.filter((a) => !isPendingDelete(a.id));
          const answerCount = getAnswerCount(question);
          const isExpanded = expandedQuestions.has(question.id);

          return (
            <Box key={question.id}>
              <CommentRow
                comment={question}
                isOwn={question.userId === user?.uid}
                isLiked={isLiked(question.id)}
                likeCount={getLikeCount(question.id, question.likeCount)}
                replyCount={answerCount}
                isEditing={false}
                editText=""
                isSavingEdit={false}
                isProfilePublic={profileVisibility.get(question.userId) ?? false}
                onToggleLike={handleToggleLike}
                onStartEdit={noopEdit}
                onSaveEdit={noopEdit}
                onCancelEdit={noopEdit}
                onEditTextChange={noopEditText}
                onDelete={handleDelete}
                onReply={handleStartReply}
                onShowProfile={handleShowProfile}
              />

              {answerCount > 0 && (
                <Box sx={{ pl: { xs: 3, sm: 5.5 }, mt: 0.5 }}>
                  <Button
                    size="small"
                    onClick={() => toggleQuestion(question.id)}
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
                      : answerCount === 1
                        ? 'Ver 1 respuesta'
                        : `Ver ${answerCount} respuestas`}
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
                      {visibleAnswers.map((answer) => {
                        const isBestAnswer = getLikeCount(answer.id, answer.likeCount) >= BEST_ANSWER_MIN_LIKES &&
                          visibleAnswers[0]?.id === answer.id;

                        return (
                          <Box key={answer.id}>
                            {isBestAnswer && (
                              <Chip
                                label="Mejor respuesta"
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem', mb: 0.5 }}
                              />
                            )}
                            <CommentRow
                              comment={answer}
                              isOwn={answer.userId === user?.uid}
                              isLiked={isLiked(answer.id)}
                              likeCount={getLikeCount(answer.id, answer.likeCount)}
                              replyCount={0}
                              isReply
                              isEditing={false}
                              editText=""
                              isSavingEdit={false}
                              isProfilePublic={profileVisibility.get(answer.userId) ?? false}
                              onToggleLike={handleToggleLike}
                              onStartEdit={noopEdit}
                              onSaveEdit={noopEdit}
                              onCancelEdit={noopEdit}
                              onEditTextChange={noopEditText}
                              onDelete={handleDelete}
                              onShowProfile={handleShowProfile}
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  </Collapse>
                </Box>
              )}

              {replyingTo?.id === question.id && userCommentsToday >= MAX_COMMENTS_PER_DAY && (
                <Box sx={{ pl: { xs: 3, sm: 5.5 }, pr: 1, pb: 1 }}>
                  <Alert severity="info" variant="outlined" sx={{ fontSize: '0.8rem', borderRadius: '12px' }}>
                    Alcanzaste el límite diario de publicaciones.
                  </Alert>
                </Box>
              )}
              {replyingTo?.id === question.id && userCommentsToday < MAX_COMMENTS_PER_DAY && (
                <Box sx={{ pl: { xs: 3, sm: 5.5 }, pr: 1, pb: 1 }}>
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
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
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

              {index < visibleQuestions.length - 1 && <Divider />}
            </Box>
          );
        })}
        {!isLoading && visibleQuestions.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No hay preguntas todavía. Sé el primero en preguntar.
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
