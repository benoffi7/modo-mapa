import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { STORAGE_KEY_ONBOARDING_CREATED_AT } from '../../constants/storage';
import { ANONYMOUS_DISPLAY_NAME } from '../../constants/ui';
import { withBusyFlag } from '../../utils/busyFlag';

export default function NameDialog() {
  const { user, displayName, setDisplayName, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOpen = !isLoading && user !== null && displayName === null;

  const markOnboardingStart = () => {
    if (!localStorage.getItem(STORAGE_KEY_ONBOARDING_CREATED_AT)) {
      localStorage.setItem(STORAGE_KEY_ONBOARDING_CREATED_AT, new Date().toISOString());
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    await withBusyFlag('profile_save', async () => {
      await setDisplayName(name.trim());
    });
    markOnboardingStart();
    setIsSubmitting(false);
  };

  const handleSkip = async () => {
    await setDisplayName(ANONYMOUS_DISPLAY_NAME);
    markOnboardingStart();
  };

  return (
    <Dialog open={isOpen} onClose={handleSkip} maxWidth="xs" fullWidth>
      <DialogTitle>Bienvenido</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Elegí un nombre para que otros usuarios vean tus comentarios y opiniones.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="Tu nombre"
          placeholder="Ej: Juan"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          slotProps={{ htmlInput: { maxLength: 30 } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleSkip} color="inherit">
          Omitir
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isSubmitting || !name.trim()}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
