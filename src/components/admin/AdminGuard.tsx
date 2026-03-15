import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext';
import { auth as firebaseAuth, functions } from '../../config/firebase';
import { ADMIN_EMAIL } from '../../constants/admin';

interface AdminGuardProps {
  children: ReactNode;
}

/**
 * In DEV mode, auto-creates and signs in as the admin user in the Auth emulator.
 * This avoids popup auth issues and ensures Firestore rules pass isAdmin().
 */
function DevAdminGuard({ children }: AdminGuardProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      const { auth } = await import('../../config/firebase');
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
      const DEV_PASSWORD = 'dev123456';

      try {
        await signInWithEmailAndPassword(auth, ADMIN_EMAIL, DEV_PASSWORD);
      } catch {
        // User doesn't exist yet — create it
        await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, DEV_PASSWORD);
      }

      // Set emailVerified + admin claim via Auth Emulator admin API so isAdmin() passes in Firestore rules
      if (auth.currentUser) {
        await fetch(
          'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:update',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
            body: JSON.stringify({
              localId: auth.currentUser.uid,
              emailVerified: true,
              customAttributes: JSON.stringify({ admin: true }),
            }),
          },
        );
        // Force token refresh to pick up emailVerified + admin claim
        await auth.currentUser.reload();
        await auth.currentUser.getIdToken(true);
      }

      if (!cancelled) setReady(true);
    };

    setup().catch((err) => {
      console.error('[DevAdminGuard] setup failed:', err);
      if (!cancelled) setReady(true); // render anyway so error is visible
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
  const [adminReady, setAdminReady] = useState(false);

  // Check if returning admin user already has the claim
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    let cancelled = false;
    user.getIdTokenResult().then((result) => {
      if (!cancelled && result.claims.admin) setAdminReady(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  // DEV: auto-login as admin in emulator
  if (import.meta.env.DEV) {
    return <DevAdminGuard>{children}</DevAdminGuard>;
  }

  const handleLogin = async () => {
    setSigningIn(true);
    setAccessDenied(false);
    const result = await signInWithGoogle();
    if (!result || !result.emailVerified) {
      setAccessDenied(true);
      if (result) await signOut();
      setSigningIn(false);
      return;
    }

    try {
      const setAdminClaim = httpsCallable<void, { admin: boolean }>(functions, 'setAdminClaim');
      const { data } = await setAdminClaim();
      if (!data.admin) {
        setAccessDenied(true);
        await signOut();
        setSigningIn(false);
        return;
      }
      // Force token refresh to pick up the new admin claim
      await firebaseAuth.currentUser?.getIdToken(true);
      setAdminReady(true);
    } catch {
      setAccessDenied(true);
      await signOut();
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
          Acceso denegado. No tenés permisos de administrador.
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

  if (!user || user.isAnonymous || !adminReady) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 3 }}>
        {signingIn ? (
          <CircularProgress />
        ) : (
          <>
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
              Iniciar sesión con Google
            </Button>
            {authError && (
              <Alert severity="error" sx={{ maxWidth: 400 }}>
                {authError}
              </Alert>
            )}
          </>
        )}
      </Box>
    );
  }

  return <>{children}</>;
}
