import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import {
  Box,
  Typography,
  Switch,
  Divider,
  Skeleton,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useColorMode } from '../../hooks/useColorMode';
import LocalityPicker from './LocalityPicker';
import { useAuth } from '../../context/AuthContext';

const EmailPasswordDialog = lazy(() => import('../auth/EmailPasswordDialog'));
const ChangePasswordDialog = lazy(() => import('../auth/ChangePasswordDialog'));

interface SettingRowProps {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  indented?: boolean;
  onChange: (value: boolean) => void;
}

function SettingRow({ label, description, checked, disabled, indented, onChange }: SettingRowProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1,
        pl: indented ? 3 : 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Box sx={{ flex: 1, mr: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: indented ? 400 : 500 }}>
          {label}
        </Typography>
        {description && (
          <Typography variant="caption" color="text.secondary">
            {description}
          </Typography>
        )}
      </Box>
      <Switch
        size="small"
        checked={checked}
        disabled={disabled}
        onChange={(_, val) => onChange(val)}
      />
    </Box>
  );
}

export default function SettingsPanel() {
  const { settings, loading, updateSetting, updateLocality, clearLocality } = useUserSettings();
  const { mode, toggleColorMode } = useColorMode();
  const { authMethod, emailVerified, user, signOut, resendVerification, refreshEmailVerified } = useAuth();

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailDialogTab, setEmailDialogTab] = useState<'register' | 'login'>('register');
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationCooldown, setVerificationCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (verificationCooldown <= 0) {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      return;
    }
    cooldownRef.current = setInterval(() => {
      setVerificationCooldown((c) => c - 1);
    }, 1000);
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, [verificationCooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    await signOut();
    setLogoutDialogOpen(false);
  };

  const handleResendVerification = async () => {
    setVerificationLoading(true);
    try {
      await resendVerification();
      setVerificationSent(true);
      setVerificationCooldown(60);
    } catch {
      // error handled by context
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleRefreshVerified = async () => {
    await refreshEmailVerified();
  };

  if (loading) {
    return (
      <Box sx={{ px: 2, py: 2 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={48} sx={{ my: 0.25 }} />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, py: 1 }}>
      {/* Cuenta */}
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

      <Divider sx={{ my: 1.5 }} />

      {/* Ubicación */}
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Ubicación
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Tu zona por defecto cuando no tenés GPS activado
      </Typography>
      <LocalityPicker
        currentLocality={settings.locality}
        onSelect={updateLocality}
        onClear={clearLocality}
      />

      <Divider sx={{ my: 1.5 }} />

      {/* Privacy */}
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Privacidad
      </Typography>
      <SettingRow
        label="Perfil público"
        description="Otros usuarios pueden ver tu actividad al tocar tu nombre"
        checked={settings.profilePublic}
        onChange={(val) => updateSetting('profilePublic', val)}
      />

      <Divider sx={{ my: 1.5 }} />

      {/* Notifications */}
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Notificaciones
      </Typography>
      <SettingRow
        label="Activar notificaciones"
        description="Recibir notificaciones dentro de la app"
        checked={settings.notificationsEnabled}
        onChange={(val) => updateSetting('notificationsEnabled', val)}
      />
      <SettingRow
        label="Likes en comentarios"
        checked={settings.notifyLikes}
        disabled={!settings.notificationsEnabled}
        indented
        onChange={(val) => updateSetting('notifyLikes', val)}
      />
      <SettingRow
        label="Fotos de menú"
        checked={settings.notifyPhotos}
        disabled={!settings.notificationsEnabled}
        indented
        onChange={(val) => updateSetting('notifyPhotos', val)}
      />
      <SettingRow
        label="Rankings"
        checked={settings.notifyRankings}
        disabled={!settings.notificationsEnabled}
        indented
        onChange={(val) => updateSetting('notifyRankings', val)}
      />
      <SettingRow
        label="Respuestas a feedback"
        checked={settings.notifyFeedback}
        disabled={!settings.notificationsEnabled}
        indented
        onChange={(val) => updateSetting('notifyFeedback', val)}
      />
      <SettingRow
        label="Respuestas a comentarios"
        checked={settings.notifyReplies}
        disabled={!settings.notificationsEnabled}
        indented
        onChange={(val) => updateSetting('notifyReplies', val)}
      />
      <SettingRow
        label="Nuevos seguidores"
        checked={settings.notifyFollowers}
        disabled={!settings.notificationsEnabled}
        indented
        onChange={(val) => updateSetting('notifyFollowers', val)}
      />
      <SettingRow
        label="Recomendaciones"
        checked={settings.notifyRecommendations}
        disabled={!settings.notificationsEnabled}
        indented
        onChange={(val) => updateSetting('notifyRecommendations', val)}
      />

      <Divider sx={{ my: 1.5 }} />

      {/* Analytics */}
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Datos de uso
      </Typography>
      <SettingRow
        label="Enviar datos de uso"
        description="Ayuda a mejorar la app enviando datos anónimos de uso"
        checked={settings.analyticsEnabled}
        onChange={(val) => updateSetting('analyticsEnabled', val)}
      />

      <Divider sx={{ my: 1.5 }} />

      {/* Apariencia */}
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Apariencia
      </Typography>
      <SettingRow
        label="Modo oscuro"
        description="Cambiar entre tema claro y oscuro"
        checked={mode === 'dark'}
        onChange={toggleColorMode}
      />

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
    </Box>
  );
}
