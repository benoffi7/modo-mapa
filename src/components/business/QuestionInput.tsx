import { Box, TextField, IconButton, Alert } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { MAX_QUESTION_LENGTH } from '../../constants/questions';
import { MAX_COMMENTS_PER_DAY } from '../../constants/validation';

interface QuestionInputProps {
  questionText: string;
  onQuestionTextChange: (text: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  userCommentsToday: number;
}

export default function QuestionInput({
  questionText,
  onQuestionTextChange,
  onSubmit,
  isSubmitting,
  userCommentsToday,
}: QuestionInputProps) {
  if (userCommentsToday >= MAX_COMMENTS_PER_DAY) {
    return (
      <Alert severity="info" sx={{ mb: 2, borderRadius: '12px' }}>
        Alcanzaste el límite de {MAX_COMMENTS_PER_DAY} publicaciones por hoy.
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start' }}>
      <TextField
        fullWidth
        size="small"
        placeholder="Hacé una pregunta..."
        value={questionText}
        onChange={(e) => onQuestionTextChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        slotProps={{ htmlInput: { maxLength: MAX_QUESTION_LENGTH } }}
        helperText={questionText.length > 0 ? `${questionText.length}/${MAX_QUESTION_LENGTH}` : undefined}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
      />
      <IconButton
        color="primary"
        onClick={onSubmit}
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
  );
}
