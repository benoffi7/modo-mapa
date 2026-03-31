import { useState, useEffect, useRef } from 'react';
import { Snackbar, Alert, IconButton, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../context/AuthContext';
import { trackEvent } from '../../utils/analytics';
import {
  STORAGE_KEY_ACCOUNT_BANNER_DISMISSED,
  STORAGE_KEY_HINT_POST_FIRST_RATING,
} from '../../constants/storage';
import {
  EVT_ONBOARDING_BANNER_SHOWN,
  EVT_ONBOARDING_BANNER_CLICKED,
  EVT_ONBOARDING_BANNER_DISMISSED,
} from '../../constants/analyticsEvents';

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

  // Stable event listener via refs (avoids re-registration on state change)
  const visibleRef = useRef(visible);
  useEffect(() => { visibleRef.current = visible; }, [visible]);
  const authMethodRef = useRef(authMethod);
  useEffect(() => { authMethodRef.current = authMethod; }, [authMethod]);

  useEffect(() => {
    const handler = () => {
      if (!visibleRef.current && shouldShow(authMethodRef.current)) {
        setVisible(true);
      }
    };
    window.addEventListener('anon-interaction', handler);
    return () => window.removeEventListener('anon-interaction', handler);
  }, []);

  useEffect(() => {
    if (visible) trackEvent(EVT_ONBOARDING_BANNER_SHOWN);
  }, [visible]);

  if (!visible || authMethod !== 'anonymous') return null;

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY_ACCOUNT_BANNER_DISMISSED, 'true');
    trackEvent(EVT_ONBOARDING_BANNER_DISMISSED);
  };

  const handleClick = () => {
    trackEvent(EVT_ONBOARDING_BANNER_CLICKED);
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
            <IconButton size="small" color="inherit" aria-label="Cerrar aviso" onClick={handleDismiss}>
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
