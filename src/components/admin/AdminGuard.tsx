import { useState } from 'react';
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '../../context/AuthContext';

const ADMIN_EMAIL = 'benoffi11@gmail.com';

interface AdminGuardProps {
  children: ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { user, isLoading, authError, signInWithGoogle, signOut } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const handleLogin = async () => {
    setSigningIn(true);
    setAccessDenied(false);
    const result = await signInWithGoogle();
    if (result && result.email !== ADMIN_EMAIL) {
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
          Acceso denegado. Solo {ADMIN_EMAIL} puede acceder al panel de administración.
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
