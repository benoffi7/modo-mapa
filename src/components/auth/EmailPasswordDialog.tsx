import { useRef, useState, useLayoutEffect } from 'react';
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
import { sendResetEmail, getAuthErrorMessage } from '../../services/emailAuth';
import { usePasswordConfirmation } from '../../hooks/usePasswordConfirmation';
import { useRememberedEmail } from '../../hooks/useRememberedEmail';
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
  const { linkEmailPassword, signInWithEmail, authError, clearAuthError } = useAuth();
  const [tab, setTab] = useState<TabValue>(initialTab);
  const { email, setEmail, remember, toggleRemember, save: saveEmail, reset: resetEmail } = useRememberedEmail();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const confirmation = usePasswordConfirmation(password, confirmPassword);

  // Preserve email on tab change, only reset passwords
  const handleTabChange = (_: unknown, value: TabValue) => {
    setTab(value);
    setPassword('');
    setConfirmPassword('');
    setLocalError(null);
    setResetSent(false);
    clearAuthError();
  };

  // Refocus email on tab change — useLayoutEffect for immediate focus
  useLayoutEffect(() => {
    if (open) requestAnimationFrame(() => emailRef.current?.focus());
  }, [tab, open]);

  const handleClose = () => {
    resetEmail();
    setPassword('');
    setConfirmPassword('');
    setLocalError(null);
    setResetSent(false);
    clearAuthError();
    onClose();
  };

  const emailValid = EMAIL_REGEX.test(email);
  const passwordValidation = validatePassword(password);
  // Register: full complexity. Login: just non-empty (legacy passwords allowed)
  const passwordValid = tab === 'register' ? passwordValidation.valid : password.length > 0;

  const registerDisabled = !emailValid || !passwordValid || !confirmation.isValid || !confirmPassword || loading;
  const loginDisabled = !emailValid || !password || loading;

  const handleRegister = async () => {
    if (registerDisabled) return;
    setLocalError(null);
    setLoading(true);
    try {
      await linkEmailPassword(email, password);
      saveEmail(email);
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
      saveEmail(email);
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
    if (tab === 'register' && !registerDisabled) handleRegister();
    else if (tab === 'login' && !loginDisabled) handleLogin();
  };

  const error = localError ?? authError;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth scroll="paper">
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
                helperText={email.length > 0 && !emailValid ? 'Formato de email inválido' : ' '}
                sx={{
                  '& .MuiInputLabel-shrink': {
                    backgroundColor: 'background.paper',
                    px: 0.5,
                  },
                }}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={remember} onChange={toggleRemember} />}
                label="Recordar mi email"
                slotProps={{ typography: { variant: 'caption' } }}
                sx={{ mt: -1.5, mb: -1 }}
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
                  error={confirmation.error}
                  helperText={confirmation.helperText}
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
