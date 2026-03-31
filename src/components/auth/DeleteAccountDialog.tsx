import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { useToast } from '../../context/ToastContext';
import { deleteAccount } from '../../services/emailAuth';
import { trackEvent } from '../../utils/analytics';
import { EVT_ACCOUNT_DELETED } from '../../constants/analyticsEvents';
import { MSG_AUTH } from '../../constants/messages';
import PasswordField from './PasswordField';

interface DeleteAccountDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function DeleteAccountDialog({ open, onClose }: DeleteAccountDialogProps) {
  const { user, authError, clearAuthError } = useAuth();
  const { isOffline } = useConnectivity();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const handleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setPassword('');
    setError(null);
    setSuccess(false);
    clearAuthError();
    onClose();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!password || loading || !user || isOffline) return;
    setLoading(true);
    setError(null);
    try {
      await deleteAccount(user, password);
      trackEvent(EVT_ACCOUNT_DELETED, { method: 'email' });
      setSuccess(true);
      toast.success(MSG_AUTH.deleteSuccess);
      closeTimerRef.current = setTimeout(handleClose, 1500);
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err) {
        const code = (err as { code: string }).code;
        if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          setError('Contraseña incorrecta');
        } else if (code === 'auth/too-many-requests') {
          setError('Demasiados intentos. Esperá unos minutos.');
        } else {
          setError('No se pudo eliminar la cuenta. Intentá de nuevo.');
        }
      } else {
        setError('No se pudo eliminar la cuenta. Intentá de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const formDisabled = !password || loading || isOffline;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth scroll="paper" role="alertdialog" aria-describedby="delete-account-warning">
      <DialogTitle>Eliminar cuenta</DialogTitle>
      <DialogContent>
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Cuenta eliminada.
          </Alert>
        )}
        {authError && !error && !success && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {authError}
          </Alert>
        )}
        {isOffline && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Necesitás conexión a internet para eliminar tu cuenta.
          </Alert>
        )}
        <Typography id="delete-account-warning" variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Esta acción es permanente. Se van a borrar todos tus datos (favoritos,
          calificaciones, comentarios, listas, fotos, etc.) y no se pueden recuperar.
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <PasswordField
            label="Confirmá tu contraseña"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            autoFocus
            name="delete-account-password"
            error={!!error}
            helperText={error || undefined}
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
          color="error"
          disabled={formDisabled}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          Eliminar cuenta permanentemente
        </Button>
      </DialogActions>
    </Dialog>
  );
}
