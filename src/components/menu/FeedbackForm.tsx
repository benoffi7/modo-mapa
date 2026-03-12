import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import { useAuth } from '../../context/AuthContext';
import { sendFeedback } from '../../services/feedback';

type FeedbackCategory = 'bug' | 'sugerencia' | 'otro';

export default function FeedbackForm() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('sugerencia');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!user || !message.trim()) return;
    setIsSubmitting(true);
    try {
      await sendFeedback(user.uid, message.trim(), category);
      setSent(true);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error sending feedback:', error);
    }
    setIsSubmitting(false);
  };

  if (sent) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CheckCircleIcon sx={{ fontSize: 48, color: '#34a853', mb: 1 }} />
        <Typography variant="body1" sx={{ fontWeight: 500 }}>
          Gracias por tu feedback
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Contanos cómo podemos mejorar la app
      </Typography>

      <Box sx={{ display: 'flex', gap: 0.75, mb: 2 }}>
        {(['bug', 'sugerencia', 'otro'] as FeedbackCategory[]).map((cat) => (
          <Chip
            key={cat}
            label={cat === 'bug' ? 'Bug' : cat === 'sugerencia' ? 'Sugerencia' : 'Otro'}
            size="small"
            onClick={() => setCategory(cat)}
            variant={category === cat ? 'filled' : 'outlined'}
            color={category === cat ? 'primary' : 'default'}
          />
        ))}
      </Box>

      <TextField
        fullWidth
        multiline
        rows={4}
        placeholder="Escribí tu mensaje..."
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
        helperText={`${message.length}/1000`}
        sx={{ mb: 2 }}
      />

      <Button
        fullWidth
        variant="contained"
        onClick={handleSubmit}
        disabled={isSubmitting || !message.trim()}
        startIcon={<SendIcon />}
      >
        Enviar
      </Button>
    </Box>
  );
}
