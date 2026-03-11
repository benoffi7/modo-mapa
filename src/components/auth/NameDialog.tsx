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

export default function NameDialog() {
  const { user, displayName, setDisplayName, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOpen = !isLoading && user !== null && displayName === null;

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    await setDisplayName(name.trim());
    setIsSubmitting(false);
  };

  const handleSkip = async () => {
    await setDisplayName('Anónimo');
  };

  return (
    <Dialog open={isOpen} maxWidth="xs" fullWidth>
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
          inputProps={{ maxLength: 30 }}
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
