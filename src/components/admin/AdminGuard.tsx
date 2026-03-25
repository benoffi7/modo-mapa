import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../utils/logger';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? '';
const DEV_PASSWORD = import.meta.env.VITE_DEV_PASSWORD ?? 'dev123456';

interface AdminGuardProps {
  children: ReactNode;
}

/**
 * In DEV mode, auto-creates and signs in as the admin user in the Auth emulator,
 * then sets the admin custom claim via the setAdminClaim Cloud Function.
 */
function DevAdminGuard({ children }: AdminGuardProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      const { auth, functions } = await import('../../config/firebase');
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
      const { httpsCallable } = await import('firebase/functions');

      try {
        await signInWithEmailAndPassword(auth, ADMIN_EMAIL, DEV_PASSWORD);
      } catch {
        await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, DEV_PASSWORD);
      }

      // Set emailVerified via Auth Emulator admin API
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        await fetch(
          'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:update',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
            body: JSON.stringify({ localId: auth.currentUser.uid, emailVerified: true }),
          },
        );
        await auth.currentUser.reload();
        await auth.currentUser.getIdToken(true);
      }

      // Set admin custom claim via Cloud Function
      const setAdmin = httpsCallable(functions, 'setAdminClaim');
      await setAdmin({ targetUid: auth.currentUser!.uid });
      // Force token refresh to pick up new claim
      await auth.currentUser!.getIdToken(true);

      if (!cancelled) setReady(true);
    };

    setup().catch((err) => {
      logger.error('[DevAdminGuard] setup failed:', err);
      if (!cancelled) setReady(true);
    });

    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { user, isLoading, authError, signInWithGoogle, signOut } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // DEV: auto-login as admin in emulator
  if (import.meta.env.DEV) {
    return <DevAdminGuard>{children}</DevAdminGuard>;
  }

  const handleLogin = async () => {
    setSigningIn(true);
    setAccessDenied(false);
    const result = await signInWithGoogle();
    if (result) {
      const { getIdTokenResult } = await import('firebase/auth');
      const tokenResult = await getIdTokenResult(result, true);
      if (tokenResult.claims.admin !== true) {
        setAccessDenied(true);
        await signOut();
      }
    }
    setSigningIn(false);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (accessDenied) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 2 }}>
        <Alert severity="error" sx={{ maxWidth: 400 }}>
          Acceso denegado. Tu cuenta no tiene permisos de administrador.
        </Alert>
        <Button
          onClick={() => {
            setAccessDenied(false);
          }}
          variant="outlined"
          size="large"
        >
          Reintentar con otra cuenta
        </Button>
      </Box>
    );
  }

  if (!user || user.isAnonymous) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 3 }}>
        <Typography variant="h4">Panel de Administración</Typography>
        <Typography variant="body1" color="text.secondary">
          Inicia sesión con tu cuenta de Google para acceder.
        </Typography>
        <Button
          onClick={handleLogin}
          variant="contained"
          size="large"
          disabled={signingIn}
        >
          {signingIn ? <CircularProgress size={24} /> : 'Iniciar sesión con Google'}
        </Button>
        {authError && (
          <Alert severity="error" sx={{ maxWidth: 400 }}>
            {authError}
          </Alert>
        )}
      </Box>
    );
  }

  return <>{children}</>;
}
