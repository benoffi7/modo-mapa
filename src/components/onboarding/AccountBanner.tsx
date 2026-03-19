import { useState, useEffect, useCallback } from 'react';
import { Snackbar, Alert, IconButton, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../context/AuthContext';
import { trackEvent } from '../../utils/analytics';
import {
  STORAGE_KEY_ACCOUNT_BANNER_DISMISSED,
  STORAGE_KEY_HINT_POST_FIRST_RATING,
} from '../../constants/storage';

function shouldShow(authMethod: string): boolean {
  if (authMethod !== 'anonymous') return false;
  if (localStorage.getItem(STORAGE_KEY_ACCOUNT_BANNER_DISMISSED) === 'true') return false;
  return localStorage.getItem(STORAGE_KEY_HINT_POST_FIRST_RATING) === 'true';
}

interface Props {
  onCreateAccount: () => void;
}

export default function AccountBanner({ onCreateAccount }: Props) {
  const { authMethod } = useAuth();
  const [visible, setVisible] = useState(() => shouldShow(authMethod));

  // Re-evaluate when user rates a business (fires 'anon-interaction' custom event)
  const handleInteraction = useCallback(() => {
    if (!visible && shouldShow(authMethod)) {
      setVisible(true);
    }
  }, [visible, authMethod]);

  useEffect(() => {
    window.addEventListener('anon-interaction', handleInteraction);
    return () => window.removeEventListener('anon-interaction', handleInteraction);
  }, [handleInteraction]);

  useEffect(() => {
    if (visible) trackEvent('onboarding_banner_shown');
  }, [visible]);

  if (!visible || authMethod !== 'anonymous') return null;

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY_ACCOUNT_BANNER_DISMISSED, 'true');
    trackEvent('onboarding_banner_dismissed');
  };

  const handleClick = () => {
    trackEvent('onboarding_banner_clicked');
    onCreateAccount();
  };

  return (
    <Snackbar
      open
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ mb: 7 }}
    >
      <Alert
        severity="info"
        variant="filled"
        action={
          <>
            <Button color="inherit" size="small" onClick={handleClick} sx={{ fontWeight: 600 }}>
              Crear cuenta
            </Button>
            <IconButton size="small" color="inherit" onClick={handleDismiss}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
      >
        Creá tu cuenta para no perder tus datos
      </Alert>
    </Snackbar>
  );
}
