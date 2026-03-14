import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Tabs,
  Tab,
  Alert,
  Box,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { PASSWORD_MIN_LENGTH } from '../../constants/auth';
import { sendResetEmail, getAuthErrorMessage } from '../../services/emailAuth';

interface EmailPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'register' | 'login';
  hasAnonymousData?: boolean;
}

type TabValue = 'register' | 'login';

export default function EmailPasswordDialog({
  open,
  onClose,
  initialTab = 'register',
  hasAnonymousData = false,
}: EmailPasswordDialogProps) {
  const { linkEmailPassword, signInWithEmail, authError } = useAuth();
  const [tab, setTab] = useState<TabValue>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setLocalError(null);
    setResetSent(false);
  };

  const handleTabChange = (_: unknown, value: TabValue) => {
    setTab(value);
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= PASSWORD_MIN_LENGTH;
  const confirmValid = tab === 'login' || password === confirmPassword;

  const registerDisabled = !emailValid || !passwordValid || !confirmValid || !confirmPassword || loading;
  const loginDisabled = !email || !password || loading;

  const handleRegister = async () => {
    if (registerDisabled) return;
    setLocalError(null);
    setLoading(true);
    try {
      await linkEmailPassword(email, password);
      handleClose();
    } catch {
      // authError is set by context
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (loginDisabled) return;
    setLocalError(null);
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      handleClose();
    } catch {
      // authError is set by context
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!emailValid) {
      setLocalError('Ingresá tu email para recibir el link de recuperación.');
      return;
    }
    setLocalError(null);
    setLoading(true);
    try {
      await sendResetEmail(email);
      setResetSent(true);
    } catch (error) {
      setLocalError(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const error = localError ?? authError;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>Cuenta</DialogTitle>
      <Tabs value={tab} onChange={handleTabChange} sx={{ px: 3 }}>
        <Tab label="Crear cuenta" value="register" />
        <Tab label="Iniciar sesión" value="login" />
      </Tabs>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {resetSent && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Te enviamos un email para restablecer tu contraseña.
          </Alert>
        )}

        {tab === 'login' && hasAnonymousData && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Si tenés datos en esta sesión, se van a perder al iniciar sesión con otra cuenta.
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            fullWidth
            size="small"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={email.length > 0 && !emailValid}
            helperText={email.length > 0 && !emailValid ? 'Formato de email inválido' : undefined}
          />
          <TextField
            label="Contraseña"
            type="password"
            autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            fullWidth
            size="small"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={password.length > 0 && !passwordValid}
            helperText={
              password.length > 0 && !passwordValid
                ? `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`
                : undefined
            }
          />
          {tab === 'register' && (
            <TextField
              label="Confirmar contraseña"
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
          )}
          {tab === 'login' && (
            <Button
              variant="text"
              size="small"
              onClick={handleForgotPassword}
              disabled={loading}
              sx={{ alignSelf: 'flex-start', textTransform: 'none', mt: -1 }}
            >
              Olvidé mi contraseña
            </Button>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        {tab === 'register' ? (
          <Button
            onClick={handleRegister}
            variant="contained"
            disabled={registerDisabled}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
          >
            Crear cuenta
          </Button>
        ) : (
          <Button
            onClick={handleLogin}
            variant="contained"
            disabled={loginDisabled}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
          >
            Iniciar sesión
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
