import { useState, useRef, useEffect } from 'react';
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
  Fade,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { EMAIL_REGEX, validatePassword } from '../../constants/auth';
import { STORAGE_KEY_REMEMBERED_EMAIL } from '../../constants/storage';
import { sendResetEmail, getAuthErrorMessage } from '../../services/emailAuth';
import PasswordField from './PasswordField';
import PasswordStrength from './PasswordStrength';

interface EmailPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'register' | 'login';
}

type TabValue = 'register' | 'login';

export default function EmailPasswordDialog({
  open,
  onClose,
  initialTab = 'register',
}: EmailPasswordDialogProps) {
  const { linkEmailPassword, signInWithEmail, authError } = useAuth();
  const [tab, setTab] = useState<TabValue>(initialTab);
  const [email, setEmail] = useState(() => localStorage.getItem(STORAGE_KEY_REMEMBERED_EMAIL) ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(() => !!localStorage.getItem(STORAGE_KEY_REMEMBERED_EMAIL));
  const emailRef = useRef<HTMLInputElement>(null);

  // S1: Preserve email on tab change, only reset passwords
  const handleTabChange = (_: unknown, value: TabValue) => {
    setTab(value);
    setPassword('');
    setConfirmPassword('');
    setLocalError(null);
    setResetSent(false);
  };

  // Refocus email on tab change
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => emailRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [tab, open]);

  const handleClose = () => {
    setEmail(localStorage.getItem(STORAGE_KEY_REMEMBERED_EMAIL) ?? '');
    setPassword('');
    setConfirmPassword('');
    setLocalError(null);
    setResetSent(false);
    onClose();
  };

  const emailValid = EMAIL_REGEX.test(email);
  const passwordValidation = validatePassword(password);
  // Register: full complexity. Login: just non-empty (legacy passwords allowed)
  const passwordValid = tab === 'register' ? passwordValidation.valid : password.length > 0;
  const confirmValid = tab === 'login' || password === confirmPassword;

  const registerDisabled = !emailValid || !passwordValid || !confirmValid || !confirmPassword || loading;
  const loginDisabled = !emailValid || !password || loading;

  const saveRememberedEmail = () => {
    if (rememberEmail) {
      localStorage.setItem(STORAGE_KEY_REMEMBERED_EMAIL, email);
    }
  };

  const handleRegister = async () => {
    if (registerDisabled) return;
    setLocalError(null);
    setLoading(true);
    try {
      await linkEmailPassword(email, password);
      saveRememberedEmail();
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
      saveRememberedEmail();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'register') handleRegister();
    else handleLogin();
  };

  const handleRememberChange = (_: unknown, checked: boolean) => {
    setRememberEmail(checked);
    if (!checked) localStorage.removeItem(STORAGE_KEY_REMEMBERED_EMAIL);
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
        <Fade in key={tab} timeout={200}>
          <Box component="form" onSubmit={handleSubmit}>
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

            {tab === 'login' && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Si tenés datos en esta sesión anónima, se van a perder al iniciar sesión con otra cuenta.
              </Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                inputRef={emailRef}
                label="Email"
                type="email"
                autoComplete="username"
                autoFocus
                fullWidth
                size="small"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={email.length > 0 && !emailValid}
                helperText={email.length > 0 && !emailValid ? 'Formato de email inválido' : undefined}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={rememberEmail} onChange={handleRememberChange} />}
                label="Recordar mi email"
                sx={{ mt: -1.5, mb: -1, '& .MuiTypography-root': { fontSize: '0.8rem' } }}
              />
              <PasswordField
                label="Contraseña"
                value={password}
                onChange={setPassword}
                autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                name="password"
              />
              {tab === 'register' && <PasswordStrength password={password} />}
              {tab === 'register' && (
                <PasswordField
                  label="Confirmar contraseña"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  name="confirm-password"
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
          </Box>
        </Fade>
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
