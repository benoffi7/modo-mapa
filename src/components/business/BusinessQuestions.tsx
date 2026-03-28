import { useState, useMemo, useCallback, memo } from 'react';
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
import { useToast } from '../../context/ToastContext';
import { createQuestion } from '../../services/comments';
import { withOfflineSupport } from '../../services/offlineInterceptor';
import { useCommentListBase } from '../../hooks/useCommentListBase';
import CommentRow from './CommentRow';
import UserProfileSheet from '../user/UserProfileSheet';
import { MAX_QUESTION_LENGTH, BEST_ANSWER_MIN_LIKES } from '../../constants/questions';
import { MAX_COMMENT_LENGTH, MAX_COMMENTS_PER_DAY } from '../../constants/validation';
import { MSG_QUESTION } from '../../constants/messages';
import { trackEvent } from '../../utils/analytics';
import type { Comment } from '../../types';
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
  const toast = useToast();
  const [questionText, setQuestionText] = useState('');
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const expandThread = useCallback((id: string) => {
    setExpandedQuestions((prev) => new Set(prev).add(id));
  }, []);

  const base = useCommentListBase({
    businessId,
    businessName,
    comments,
    userCommentLikes,
    onCommentsChange,
    deleteMessage: 'Pregunta eliminada',
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

  // Separate questions and answers from all comments
  const { questions, answersByQuestion } = useMemo(() => {
    const qs: Comment[] = [];
    const answers = new Map<string, Comment[]>();

    for (const c of comments) {
      if (c.type === 'question' && !c.parentId) {
        qs.push(c);
      } else if (c.parentId) {
        const existing = answers.get(c.parentId) ?? [];
        existing.push(c);
        answers.set(c.parentId, existing);
      }
    }

    for (const [key, arr] of answers) {
      answers.set(key, arr.sort((a, b) => b.likeCount - a.likeCount));
    }

    qs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return { questions: qs, answersByQuestion: answers };
  }, [comments]);

  const questionIds = useMemo(() => new Set(questions.map((q) => q.id)), [questions]);
  const filteredAnswersByQuestion = useMemo(() => {
    const filtered = new Map<string, Comment[]>();
    for (const [parentId, answers] of answersByQuestion) {
      if (questionIds.has(parentId)) {
        filtered.set(parentId, answers);
      }
    }
    return filtered;
  }, [answersByQuestion, questionIds]);

  // Handlers
  const handleSubmitQuestion = async () => {
    if (!user || !questionText.trim()) return;
    if (userCommentsToday >= MAX_COMMENTS_PER_DAY) return;
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
  };

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
        trackEvent('question_viewed', { business_id: businessId, question_id: questionId });
      }
      return next;
    });
  };

  // No-op handlers for CommentRow edit props (questions don't support inline edit)
  const noopEdit = useCallback(() => {}, []);
  const noopEditText = useCallback(() => {}, []);

  const getAnswerCount = (question: Comment): number => {
    const localAnswers = filteredAnswersByQuestion.get(question.id);
    return question.replyCount ?? localAnswers?.length ?? 0;
  };

  const visibleQuestions = useMemo(
    () => questions.filter((q) => !isPendingDelete(q.id)),
    [questions, isPendingDelete],
  );

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <HelpOutlineIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Preguntas ({isLoading ? '...' : visibleQuestions.length})
        </Typography>
      </Box>

      {user && userCommentsToday < MAX_COMMENTS_PER_DAY && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Hacé una pregunta..."
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitQuestion();
              }
            }}
            slotProps={{ htmlInput: { maxLength: MAX_QUESTION_LENGTH } }}
            helperText={questionText.length > 0 ? `${questionText.length}/${MAX_QUESTION_LENGTH}` : undefined}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
          />
          <IconButton
            color="primary"
            onClick={handleSubmitQuestion}
            disabled={isSubmitting || !questionText.trim()}
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
      {user && userCommentsToday >= MAX_COMMENTS_PER_DAY && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: '12px' }}>
          Alcanzaste el límite de {MAX_COMMENTS_PER_DAY} publicaciones por hoy.
        </Alert>
      )}

      <List disablePadding>
        {visibleQuestions.map((question, index) => {
          const answers = filteredAnswersByQuestion.get(question.id) ?? [];
          const visibleAnswers = answers.filter((a) => !isPendingDelete(a.id));
          const answerCount = getAnswerCount(question);
          const isExpanded = expandedQuestions.has(question.id);

          return (
            <Box key={question.id}>
              <CommentRow
                comment={question}
                isOwn={question.userId === user?.uid}
                isLiked={isLiked(question.id)}
                likeCount={getLikeCount(question)}
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
                        const isBestAnswer = getLikeCount(answer) >= BEST_ANSWER_MIN_LIKES &&
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
                              likeCount={getLikeCount(answer)}
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

      <UserProfileSheet userId={profileUser?.id ?? null} {...(profileUser?.name != null && { userName: profileUser.name })} onClose={closeProfile} />
    </Box>
  );
});
