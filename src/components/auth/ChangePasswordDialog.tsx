import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Box,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { validatePassword } from '../../constants/auth';
import { usePasswordConfirmation } from '../../hooks/usePasswordConfirmation';
import PasswordField from './PasswordField';
import PasswordStrength from './PasswordStrength';
import { withBusyFlag } from '../../utils/busyFlag';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const { changePassword, authError, clearAuthError } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const confirmation = usePasswordConfirmation(newPassword, confirmPassword);
  const newPasswordValid = validatePassword(newPassword).valid;
  const formDisabled = !currentPassword || !newPasswordValid || !confirmation.isValid || !confirmPassword || loading;

  // Cleanup timeout on unmount
  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSuccess(false);
  };

  const handleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    resetForm();
    clearAuthError();
    onClose();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (formDisabled) return;
    setLoading(true);
    setSuccess(false);
    try {
      await withBusyFlag('password_change', async () => {
        await changePassword(currentPassword, newPassword);
      });
      setSuccess(true);
      closeTimerRef.current = setTimeout(handleClose, 1500);
    } catch {
      // authError is set by context
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth scroll="paper">
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
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <PasswordField
            label="Contraseña actual"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            autoFocus
            name="current-password"
          />
          <PasswordField
            label="Nueva contraseña"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            name="new-password"
          />
          <PasswordStrength password={newPassword} />
          <PasswordField
            label="Confirmar nueva contraseña"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            name="confirm-password"
            error={confirmation.error}
            helperText={confirmation.helperText}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={() => handleSubmit()}
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
