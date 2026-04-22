import { memo } from 'react';
import type { RefObject } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import CommentRow from './CommentRow';
import { BEST_ANSWER_MIN_LIKES } from '../../constants/questions';
import { MAX_COMMENT_LENGTH, MAX_COMMENTS_PER_DAY } from '../../constants/validation';
import type { Comment } from '../../types';

export interface QuestionAnswerThreadProps {
  question: Comment;
  answers: Comment[];
  currentUserId: string | null | undefined;
  isLiked: (commentId: string) => boolean;
  getLikeCount: (comment: Comment) => number;
  replyCount: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onToggleLike: (commentId: string) => void;
  onDelete: (comment: Comment) => void;
  onStartReply: (comment: Comment) => void;
  onShowProfile: (userId: string, userName: string) => void;
  profileVisibility: Map<string, boolean>;
  // Reply form (cuando esta pregunta es la target)
  replyingToThis: boolean;
  replyingToName: string | null;
  replyText: string;
  setReplyText: (value: string) => void;
  onSubmitReply: () => void;
  onCancelReply: () => void;
  isSubmitting: boolean;
  userCommentsToday: number;
  replyInputRef: RefObject<HTMLInputElement | null>;
  isPendingDelete: (commentId: string) => boolean;
}

/**
 * Render de una pregunta: fila + respuestas colapsables + badge
 * "Mejor respuesta" + reply form. Extraído de BusinessQuestions (S5).
 */
export default memo(function QuestionAnswerThread({
  question,
  answers,
  currentUserId,
  isLiked,
  getLikeCount,
  replyCount,
  isExpanded,
  onToggleExpanded,
  onToggleLike,
  onDelete,
  onStartReply,
  onShowProfile,
  profileVisibility,
  replyingToThis,
  replyingToName,
  replyText,
  setReplyText,
  onSubmitReply,
  onCancelReply,
  isSubmitting,
  userCommentsToday,
  replyInputRef,
  isPendingDelete,
}: QuestionAnswerThreadProps) {
  const visibleAnswers = answers.filter((a) => !isPendingDelete(a.id));
  const overDailyLimit = userCommentsToday >= MAX_COMMENTS_PER_DAY;

  return (
    <>
      <CommentRow
        comment={question}
        isOwn={question.userId === currentUserId}
        isLiked={isLiked(question.id)}
        likeCount={getLikeCount(question)}
        replyCount={replyCount}
        isProfilePublic={profileVisibility.get(question.userId) ?? false}
        onToggleLike={onToggleLike}
        onDelete={onDelete}
        onReply={onStartReply}
        onShowProfile={onShowProfile}
      />

      {replyCount > 0 && (
        <Box sx={{ pl: { xs: 3, sm: 5.5 }, mt: 0.5 }}>
          <Button
            size="small"
            onClick={onToggleExpanded}
            sx={{ textTransform: 'none', fontSize: '0.75rem', color: 'primary.main', fontWeight: 600, p: '2px 6px' }}
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
              {visibleAnswers.map((answer) => {
                const isBestAnswer =
                  getLikeCount(answer) >= BEST_ANSWER_MIN_LIKES &&
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
                      isOwn={answer.userId === currentUserId}
                      isLiked={isLiked(answer.id)}
                      likeCount={getLikeCount(answer)}
                      replyCount={0}
                      isReply
                      isProfilePublic={profileVisibility.get(answer.userId) ?? false}
                      onToggleLike={onToggleLike}
                      onDelete={onDelete}
                      onShowProfile={onShowProfile}
                    />
                  </Box>
                );
              })}
            </Box>
          </Collapse>
        </Box>
      )}

      {replyingToThis && overDailyLimit && (
        <Box sx={{ pl: { xs: 3, sm: 5.5 }, pr: 1, pb: 1 }}>
          <Alert severity="info" variant="outlined" sx={{ fontSize: '0.8rem', borderRadius: '12px' }}>
            Alcanzaste el límite diario de publicaciones.
          </Alert>
        </Box>
      )}
      {replyingToThis && !overDailyLimit && (
        <Box sx={{ pl: { xs: 3, sm: 5.5 }, pr: 1, pb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Respondiendo a {replyingToName}...
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
                  onSubmitReply();
                }
                if (e.key === 'Escape') {
                  onCancelReply();
                }
              }}
              slotProps={{ htmlInput: { maxLength: MAX_COMMENT_LENGTH } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
            />
            <IconButton
              size="small"
              color="primary"
              onClick={onSubmitReply}
              disabled={isSubmitting || !replyText.trim()}
              aria-label="Enviar respuesta"
              sx={{
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                width: 44,
                height: 44,
                flexShrink: 0,
                '&:hover': { bgcolor: 'primary.dark' },
                '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
              }}
            >
              <SendIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={onCancelReply}
              aria-label="Cancelar respuesta"
              sx={{ color: 'text.secondary', width: 44, height: 44, flexShrink: 0 }}
            >
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        </Box>
      )}
    </>
  );
});
