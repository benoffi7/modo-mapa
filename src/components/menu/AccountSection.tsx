import { useState, lazy, Suspense } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import { useAuth } from '../../context/AuthContext';
import { useVerificationCooldown } from '../../hooks/useVerificationCooldown';

const EmailPasswordDialog = lazy(() => import('../auth/EmailPasswordDialog'));
const ChangePasswordDialog = lazy(() => import('../auth/ChangePasswordDialog'));

export default function AccountSection() {
  const { authMethod, emailVerified, user, signOut, resendVerification, refreshEmailVerified } = useAuth();

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailDialogTab, setEmailDialogTab] = useState<'register' | 'login'>('register');
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const { verificationSent, verificationLoading, verificationCooldown, handleResendVerification } =
    useVerificationCooldown(() => resendVerification());

  const handleRefreshVerified = async () => {
    await refreshEmailVerified();
  };

  const handleLogout = async () => {
    await signOut();
    setLogoutDialogOpen(false);
  };

  return (
    <>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Cuenta
      </Typography>

      {authMethod === 'anonymous' ? (
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Tu cuenta es temporal. Creá una cuenta para no perder tus datos.
          </Typography>
          <Button
            variant="contained"
            size="small"
            fullWidth
            startIcon={<EmailOutlinedIcon />}
            onClick={() => { setEmailDialogTab('register'); setEmailDialogOpen(true); }}
          >
            Crear cuenta con email
          </Button>
          <Button
            variant="text"
            size="small"
            fullWidth
            onClick={() => { setEmailDialogTab('login'); setEmailDialogOpen(true); }}
            sx={{ mt: 0.5 }}
          >
            Ya tengo cuenta
          </Button>
        </Box>
      ) : (
        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
              {user?.email}
            </Typography>
            <Chip
              label={emailVerified ? 'Verificado' : 'No verificado'}
              size="small"
              color={emailVerified ? 'success' : 'warning'}
              variant="outlined"
              onClick={emailVerified ? undefined : handleRefreshVerified}
            />
          </Box>
          {!emailVerified && (
            <Box sx={{ mb: 1 }}>
              {verificationSent && verificationCooldown > 0 ? (
                <Typography variant="caption" color="success.main">
                  Email enviado. Podés re-enviar en {verificationCooldown}s.
                </Typography>
              ) : (
                <Button
                  variant="text"
                  size="small"
                  onClick={handleResendVerification}
                  disabled={verificationLoading || verificationCooldown > 0}
                  sx={{ textTransform: 'none' }}
                >
                  Re-enviar email de verificación
                </Button>
              )}
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {authMethod === 'email' && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => setChangePasswordOpen(true)}
              >
                Cambiar contraseña
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              color="error"
              onClick={() => setLogoutDialogOpen(true)}
            >
              Cerrar sesión
            </Button>
          </Box>
        </Box>
      )}

      {/* Email auth dialog */}
      <Suspense fallback={null}>
        {emailDialogOpen && (
          <EmailPasswordDialog
            open={emailDialogOpen}
            onClose={() => setEmailDialogOpen(false)}
            initialTab={emailDialogTab}
          />
        )}
      </Suspense>

      {/* Change password dialog */}
      <Suspense fallback={null}>
        {changePasswordOpen && (
          <ChangePasswordDialog
            open={changePasswordOpen}
            onClose={() => setChangePasswordOpen(false)}
          />
        )}
      </Suspense>

      {/* Logout confirmation dialog */}
      <Dialog open={logoutDialogOpen} onClose={() => setLogoutDialogOpen(false)} maxWidth="xs">
        <DialogTitle>¿Cerrar sesión?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Vas a necesitar tu email y contraseña para volver a entrar.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogoutDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleLogout} color="error" variant="contained">
            Cerrar sesión
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
