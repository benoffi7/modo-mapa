import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { MSG_ADMIN } from '../../../constants/messages/admin';

interface ModerationEditorProps {
  bannedWords: string[];
  onSave: (words: string[]) => Promise<void>;
}

export default function ModerationEditor({ bannedWords, onSave }: ModerationEditorProps) {
  const [words, setWords] = useState<string[]>([...bannedWords]);
  const [newWord, setNewWord] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const hasChanges =
    words.length !== bannedWords.length ||
    words.some((w, i) => w !== bannedWords[i]);

  function handleAdd() {
    const trimmed = newWord.trim().toLowerCase();
    if (!trimmed) return;
    if (trimmed.length > 50) {
      setError('La palabra no puede tener más de 50 caracteres');
      return;
    }
    if (words.includes(trimmed)) {
      setError('Esta palabra ya está en la lista');
      return;
    }
    setWords([...words, trimmed]);
    setNewWord('');
    setError(null);
  }

  function handleDelete(index: number) {
    setWords(words.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }

  async function handleConfirmSave() {
    setConfirmOpen(false);
    setSaving(true);
    try {
      await onSave(words);
      setToast({ open: true, message: MSG_ADMIN.moderationSaveSuccess, severity: 'success' });
    } catch {
      setToast({ open: true, message: MSG_ADMIN.moderationSaveError, severity: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Palabras baneadas
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
        {words.map((word, i) => (
          <Chip
            key={word}
            label={word}
            size="small"
            onDelete={() => handleDelete(i)}
          />
        ))}
        {words.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Sin palabras baneadas
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <TextField
          size="small"
          placeholder="Agregar palabra"
          value={newWord}
          onChange={(e) => {
            setNewWord(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          disabled={saving}
        />
        <Button variant="outlined" size="small" onClick={handleAdd} disabled={saving}>
          Agregar
        </Button>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}

      <Button
        variant="contained"
        size="small"
        onClick={() => setConfirmOpen(true)}
        disabled={!hasChanges || saving || !navigator.onLine}
        startIcon={saving ? <CircularProgress size={16} /> : undefined}
      >
        Guardar cambios
      </Button>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{MSG_ADMIN.moderationConfirmTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>{MSG_ADMIN.moderationConfirmBody}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancelar</Button>
          <Button onClick={handleConfirmSave} variant="contained">
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      >
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
