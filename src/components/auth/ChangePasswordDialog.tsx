import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { PASSWORD_MIN_LENGTH } from '../../constants/auth';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const { changePassword, authError } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const newPasswordValid = newPassword.length >= PASSWORD_MIN_LENGTH;
  const confirmValid = newPassword === confirmPassword;
  const formDisabled = !currentPassword || !newPasswordValid || !confirmValid || !confirmPassword || loading;

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (formDisabled) return;
    setLoading(true);
    setSuccess(false);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      setTimeout(handleClose, 1500);
    } catch {
      // authError is set by context
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Cambiar contraseña</DialogTitle>
      <DialogContent>
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Contraseña actualizada.
          </Alert>
        )}
        {authError && !success && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {authError}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            fullWidth
            size="small"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <TextField
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            fullWidth
            size="small"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={newPassword.length > 0 && !newPasswordValid}
            helperText={
              newPassword.length > 0 && !newPasswordValid
                ? `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`
                : undefined
            }
          />
          <TextField
            label="Confirmar nueva contraseña"
            type="password"
            autoComplete="new-password"
            fullWidth
            size="small"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={confirmPassword.length > 0 && !confirmValid}
            helperText={
              confirmPassword.length > 0 && !confirmValid
                ? 'Las contraseñas no coinciden'
                : undefined
            }
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={formDisabled}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          Cambiar contraseña
        </Button>
      </DialogActions>
    </Dialog>
  );
}
