import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  IconButton,
} from '@mui/material';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { trackEvent } from '../../utils/analytics';
import { STORAGE_KEY_VERIFICATION_NUDGE_DISMISSED } from '../../constants/storage';

export default function VerificationNudge() {
  const { authMethod, emailVerified, resendVerification, refreshEmailVerified } = useAuth();
  const toast = useToast();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY_VERIFICATION_NUDGE_DISMISSED) === 'true',
  );
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  // Reset dismissal on new session if still unverified
  useEffect(() => {
    if (authMethod === 'email' && !emailVerified) {
      const sessionKey = 'verification_nudge_session';
      if (sessionStorage.getItem(sessionKey) !== 'true') {
        sessionStorage.setItem(sessionKey, 'true');
        setDismissed(false);
        localStorage.removeItem(STORAGE_KEY_VERIFICATION_NUDGE_DISMISSED);
      }
    }
  }, [authMethod, emailVerified]);

  const show = authMethod === 'email' && !emailVerified && !dismissed;

  useEffect(() => {
    if (show) trackEvent('verification_nudge_shown');
  }, [show]);

  if (!show) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      await resendVerification();
      toast.success('Email de verificación enviado');
      trackEvent('verification_nudge_resend');
    } catch {
      toast.error('No se pudo enviar el email');
    } finally {
      setSending(false);
    }
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      const verified = await refreshEmailVerified();
      if (verified) {
        toast.success('¡Email verificado!');
        // Will auto-hide because emailVerified becomes true
      } else {
        toast.info('Todavía no verificado. Revisá tu bandeja de entrada.');
      }
    } finally {
      setChecking(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY_VERIFICATION_NUDGE_DISMISSED, 'true');
    trackEvent('verification_nudge_dismissed');
  };

  return (
    <Card variant="outlined" sx={{ mx: 2, mb: 1, borderRadius: 2 }}>
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <MarkEmailReadIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
              Verificá tu email
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleDismiss} aria-label="Cerrar nudge de verificación" sx={{ p: 0.25 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mb: 1 }}>
          Obtené el badge de verificado y más confianza en la comunidad.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" onClick={handleResend} disabled={sending}>
            {sending ? 'Enviando...' : 'Re-enviar email'}
          </Button>
          <Button size="small" variant="text" onClick={handleCheck} disabled={checking}>
            {checking ? 'Verificando...' : 'Ya verifiqué'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
