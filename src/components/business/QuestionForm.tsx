import { memo } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import SendIcon from '@mui/icons-material/Send';
import { MAX_QUESTION_LENGTH } from '../../constants/questions';
import { MAX_COMMENTS_PER_DAY } from '../../constants/validation';

export interface QuestionFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  userCommentsToday: number;
}

/**
 * Input + límite diario de preguntas. Extraído de `BusinessQuestions.tsx`
 * para bajar el LOC del archivo orquestador (S5).
 */
export default memo(function QuestionForm({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  userCommentsToday,
}: QuestionFormProps) {
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        slotProps={{ htmlInput: { maxLength: MAX_QUESTION_LENGTH } }}
        helperText={value.length > 0 ? `${value.length}/${MAX_QUESTION_LENGTH}` : undefined}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
      />
      <IconButton
        color="primary"
        onClick={onSubmit}
        disabled={isSubmitting || !value.trim()}
        aria-label="Publicar pregunta"
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
        <SendIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
});
