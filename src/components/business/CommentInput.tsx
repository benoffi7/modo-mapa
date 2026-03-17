import { useState, memo } from 'react';
import { Box, TextField, IconButton, Alert } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { MAX_COMMENT_LENGTH, MAX_COMMENTS_PER_DAY } from '../../constants/validation';

interface Props {
  userCommentsToday: number;
  isSubmitting: boolean;
  onSubmit: (text: string) => void;
  onTextChange?: (text: string) => void;
}

export default memo(function CommentInput({ userCommentsToday, isSubmitting, onSubmit, onTextChange }: Props) {
  const [text, setText] = useState('');
  const remaining = MAX_COMMENTS_PER_DAY - userCommentsToday;

  if (userCommentsToday >= MAX_COMMENTS_PER_DAY) {
    return (
      <Alert severity="info" sx={{ mb: 2, borderRadius: '12px' }}>
        Alcanzaste el límite de {MAX_COMMENTS_PER_DAY} comentarios por hoy. Podés comentar de nuevo mañana.
      </Alert>
    );
  }

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText('');
    onTextChange?.('');
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start' }}>
      <TextField
        fullWidth
        size="small"
        placeholder="Dejá tu comentario..."
        value={text}
        onChange={(e) => { setText(e.target.value); onTextChange?.(e.target.value); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        slotProps={{ htmlInput: { maxLength: MAX_COMMENT_LENGTH } }}
        helperText={
          userCommentsToday > 0
            ? text.length > 0
              ? `${text.length}/${MAX_COMMENT_LENGTH} · ${userCommentsToday}/${MAX_COMMENTS_PER_DAY} hoy`
              : `${userCommentsToday}/${MAX_COMMENTS_PER_DAY} comentarios hoy`
            : text.length > 0
              ? `${text.length}/${MAX_COMMENT_LENGTH}`
              : undefined
        }
        FormHelperTextProps={{
          sx: remaining <= 3 && userCommentsToday > 0 ? { color: 'warning.main' } : undefined,
        }}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
      />
      <IconButton
        color="primary"
        onClick={handleSubmit}
        disabled={isSubmitting || !text.trim()}
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
});
