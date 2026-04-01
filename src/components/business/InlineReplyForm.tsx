import {
  Box,
  Typography,
  TextField,
  IconButton,
  Alert,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import { MAX_COMMENT_LENGTH } from '../../constants/validation';

interface Props {
  replyingToName: string;
  replyText: string;
  onReplyTextChange: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  isOverDailyLimit: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}

export default function InlineReplyForm({
  replyingToName,
  replyText,
  onReplyTextChange,
  onSubmit,
  onCancel,
  isSubmitting,
  isOverDailyLimit,
  inputRef,
}: Props) {
  if (isOverDailyLimit) {
    return (
      <Box sx={{ pl: { xs: 3, sm: 5.5 }, pr: 1, pb: 1 }}>
        <Alert severity="info" variant="outlined" sx={{ fontSize: '0.8rem', borderRadius: '12px' }}>
          Alcanzaste el límite diario de publicaciones.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ pl: { xs: 3, sm: 5.5 }, pr: 1, pb: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        Respondiendo a {replyingToName}...
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          placeholder="Escribí tu respuesta..."
          value={replyText}
          onChange={(e) => onReplyTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
            if (e.key === 'Escape') {
              onCancel();
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
          onClick={onSubmit}
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
          onClick={onCancel}
          sx={{ color: 'text.secondary', width: 44, height: 44, flexShrink: 0 }}
          aria-label="Cancelar respuesta"
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
