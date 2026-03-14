import { useState, useRef, lazy, Suspense } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  Tab,
  Tabs,
  CircularProgress,
  IconButton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../context/AuthContext';
import { sendFeedback } from '../../services/feedback';
import { MAX_FEEDBACK_MEDIA_SIZE } from '../../constants/feedback';
import type { FeedbackCategory } from '../../types';

const MyFeedbackList = lazy(() => import('./MyFeedbackList'));

const ALLOWED_ACCEPT = 'image/jpeg,image/png,image/webp';

function FeedbackSender() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('sugerencia');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FEEDBACK_MEDIA_SIZE) {
      return;
    }

    setMediaFile(file);
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
  };

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!user || !message.trim()) return;
    setIsSubmitting(true);
    try {
      await sendFeedback(user.uid, message.trim(), category, mediaFile ?? undefined);
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

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
        {([
          { value: 'bug', label: 'Bug' },
          { value: 'sugerencia', label: 'Sugerencia' },
          { value: 'datos_usuario', label: 'Datos de usuario' },
          { value: 'datos_comercio', label: 'Datos de comercio' },
          { value: 'otro', label: 'Otro' },
        ] as { value: FeedbackCategory; label: string }[]).map(({ value, label }) => (
          <Chip
            key={value}
            label={label}
            size="small"
            onClick={() => setCategory(value)}
            variant={category === value ? 'filled' : 'outlined'}
            color={category === value ? 'primary' : 'default'}
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

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_ACCEPT}
        hidden
        onChange={handleFileChange}
      />

      {mediaPreview ? (
        <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
          <Box
            component="img"
            src={mediaPreview}
            alt="Vista previa"
            sx={{ maxHeight: 120, maxWidth: '100%', borderRadius: 1, objectFit: 'cover' }}
          />
          <IconButton
            size="small"
            onClick={clearMedia}
            sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ) : (
        <Button
          size="small"
          variant="outlined"
          startIcon={<AttachFileIcon />}
          onClick={() => fileInputRef.current?.click()}
          sx={{ mb: 2 }}
        >
          Adjuntar imagen
        </Button>
      )}

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

export default function FeedbackForm() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
        <Tab label="Enviar" />
        <Tab label="Mis envíos" />
      </Tabs>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {tab === 0 && <FeedbackSender />}
        {tab === 1 && (
          <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>}>
            <MyFeedbackList />
          </Suspense>
        )}
      </Box>
    </Box>
  );
}
